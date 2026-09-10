"use client";

import { useState, type ChangeEvent } from "react";
import { Button } from "@/components/ui/button";
import { FormCard } from "@/components/form-card";
import {
  ApiError,
  conferirPlanilha,
  importarPlanilha,
  type ImportacaoConcluida,
  type RelatorioDeImportacao,
} from "@/lib/api-client";

/**
 * SPEC-038/TASK-004 — **subir a planilha, conferir, importar.**
 *
 * ## Três estados, e a ordem entre eles é a spec
 *
 * 1. **escolher** — nada foi enviado;
 * 2. **conferido** — o relatório está na tela e **nada foi escrito**;
 * 3. **importado** — as contas existem, e as senhas estão à vista **uma única
 *    vez**.
 *
 * O passo 2 é o que torna aceitável o "tudo ou nada" do passo 3: o gestor vê o
 * estrago antes de causá-lo. *Sem ele, uma linha ruim em 300 recusaria o
 * arquivo inteiro sem explicação prévia — e ele tentaria de novo às cegas.*
 *
 * ## As senhas saem uma vez, e a tela diz isso ANTES
 *
 * `senhaTemporaria` não é recuperável: nenhuma rota a devolve, e o caminho
 * para quem perder é regenerar aluno por aluno. O aviso vem em cima da lista,
 * não embaixo — depois de fechar a página é tarde.
 */
const MODELO = [
  "nome,email,telefone,dataNascimento,emergenciaNome,emergenciaTelefone,nivel",
  "Ana Souza,ana@exemplo.com,11999990000,1990-05-10,Beto Souza,11988887777,Iniciante",
  "Carlos Lima,carlos@exemplo.com,,,,,",
].join("\n");

const MENSAGEM: Record<string, string> = {
  PLANILHA_SEM_CABECALHO:
    "A primeira linha precisa ser o cabeçalho, com pelo menos as colunas `nome` e `email`. Baixe o modelo abaixo.",
  PLANILHA_VAZIA:
    "A planilha tem cabeçalho e nenhum aluno. Preencha ao menos uma linha.",
};

export function ImportarAlunos() {
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [relatorio, setRelatorio] = useState<RelatorioDeImportacao | null>(
    null,
  );
  const [concluida, setConcluida] = useState<ImportacaoConcluida | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  function escolher(evento: ChangeEvent<HTMLInputElement>) {
    setArquivo(evento.target.files?.[0] ?? null);
    // Trocar o arquivo apaga o relatório do anterior. Deixá-lo na tela faria
    // o gestor importar um arquivo tendo conferido outro.
    setRelatorio(null);
    setConcluida(null);
    setErro(null);
  }

  function traduzir(e: unknown): string {
    const code = e instanceof ApiError ? e.code : undefined;
    return (
      (code ? MENSAGEM[code] : undefined) ??
      (e instanceof ApiError ? e.message : "Não foi possível ler a planilha.")
    );
  }

  async function conferir() {
    if (!arquivo) return;
    setErro(null);
    setOcupado(true);
    try {
      setRelatorio(await conferirPlanilha(arquivo));
    } catch (e) {
      setErro(traduzir(e));
    } finally {
      setOcupado(false);
    }
  }

  async function importar() {
    if (!arquivo) return;
    setErro(null);
    setOcupado(true);
    try {
      setConcluida(await importarPlanilha(arquivo));
      setRelatorio(null);
    } catch (e) {
      setErro(traduzir(e));
    } finally {
      setOcupado(false);
    }
  }

  function baixarModelo() {
    const url = URL.createObjectURL(
      new Blob([MODELO], { type: "text/csv;charset=utf-8" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "modelo-alunos.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const semErros = relatorio !== null && relatorio.erros.length === 0;

  return (
    <FormCard
      title="Importar alunos"
      description="Um arquivo CSV com cabeçalho. Confira antes de importar: se houver qualquer problema, nada é gravado."
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="file"
            accept=".csv,text/csv"
            aria-label="Arquivo CSV"
            onChange={escolher}
            disabled={ocupado}
            className="text-sm"
          />
          <Button
            type="button"
            variant="outline"
            onClick={baixarModelo}
            className="h-9 px-4 text-[12px] font-semibold"
          >
            Baixar modelo
          </Button>
        </div>

        {erro ? (
          <p
            role="alert"
            className="text-sm font-semibold text-[var(--color-error)]"
          >
            {erro}
          </p>
        ) : null}

        {relatorio ? (
          <div className="flex flex-col gap-2 rounded-xl border border-border p-4">
            <p className="text-sm font-semibold">
              {relatorio.total} linha{relatorio.total === 1 ? "" : "s"} ·{" "}
              {relatorio.validas} válida
              {relatorio.validas === 1 ? "" : "s"} · {relatorio.erros.length}{" "}
              com problema
            </p>
            {relatorio.erros.length > 0 ? (
              <ul className="flex flex-col gap-1">
                {relatorio.erros.map((e, i) => (
                  <li
                    key={`${e.linha}-${e.coluna}-${i}`}
                    className="text-xs text-[var(--color-error)]"
                  >
                    {/* O número é o da PLANILHA, contando o cabeçalho — é o
                        que o gestor vê no Excel. */}
                    <strong>Linha {e.linha}</strong> ({e.coluna}): {e.mensagem}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-[var(--color-primary)]">
                Nenhum problema. Pode importar.
              </p>
            )}
          </div>
        ) : null}

        {concluida ? (
          <div className="flex flex-col gap-2 rounded-xl border border-[var(--color-primary)] p-4">
            <p className="text-sm font-semibold text-[var(--color-primary)]">
              {concluida.criados.length} aluno
              {concluida.criados.length === 1 ? "" : "s"} importado
              {concluida.criados.length === 1 ? "" : "s"}.
            </p>
            {/* **O aviso vem ANTES da lista, não depois.** Depois de fechar a
                página é tarde: nenhuma rota devolve estas senhas de novo. */}
            <p className="text-xs font-semibold text-[var(--color-error)]">
              Copie as senhas agora. Elas aparecem uma única vez — depois só dá
              para gerar outra, aluno por aluno.
            </p>
            <ul className="flex flex-col gap-1">
              {concluida.criados.map((c) => (
                <li key={c.alunoId} className="font-mono text-xs">
                  {c.email} · {c.senhaTemporaria}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="flex justify-end gap-3 border-t border-border pt-4">
          <Button
            type="button"
            variant="outline"
            disabled={ocupado || arquivo === null}
            onClick={() => void conferir()}
            className="h-10 px-5 text-[13px] font-semibold"
          >
            {ocupado ? "Lendo..." : "Conferir"}
          </Button>
          <Button
            type="button"
            // **Só libera depois de conferir e não haver erro.** O servidor
            // recusaria de qualquer jeito (é tudo ou nada), e deixar o botão
            // vivo convidaria à tentativa que só volta com o mesmo relatório.
            disabled={ocupado || !semErros}
            onClick={() => void importar()}
            className="h-10 px-5 text-[13px] font-semibold"
          >
            {ocupado ? "Importando..." : "Importar"}
          </Button>
        </div>
      </div>
    </FormCard>
  );
}
