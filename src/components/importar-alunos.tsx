"use client";

import { useState, type ChangeEvent } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { FormCard } from "@/components/form-card";
import { MOTIVO_DO_ENVIO } from "@/components/convite-de-acesso-card";
import {
  ApiError,
  conferirPlanilha,
  importarPlanilha,
  type AlunoImportado,
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
 *
 * ## SPEC-083 — quem recebe convite é escolhido no passo 2
 *
 * Depois de conferir sem erro, cada linha válida ganha a caixa "enviar convite
 * por e-mail", **desmarcada** (D5): convite sai só para quem o gestor marcou,
 * nunca por padrão. A linha marcada nasce sem senha conhecida e recebe o link;
 * a desmarcada sai com a senha temporária, exatamente como antes.
 */

/**
 * SPEC-083/D2 — **o modelo é o arquivo de referência da spec, byte a byte.**
 *
 * `;` como separador, BOM UTF-8 e CRLF: é o que o Excel em português abre já
 * em colunas. Com vírgula e sem BOM (o modelo antigo), o cabeçalho inteiro
 * virava uma coluna só e os acentos chegavam quebrados. O telefone vai com
 * máscara porque, só com dígitos, o Excel o converte em número (LIM-083f).
 *
 * O teste confere o SHA-256 dos bytes baixados contra o da fixture do Back
 * (`test/fixtures/modelo-alunos.csv`), que passa na conferência sem erro de
 * cabeçalho (AC-006). Mudar uma letra aqui sem mudar lá reprova.
 */
const BOM = "﻿";
const MODELO =
  BOM +
  [
    "nome;email;telefone;nivel;turma",
    "Ana Souza;ana@exemplo.com;(11) 99999-0000;Iniciante;Turma Terça 19h",
    "Carlos Lima;carlos@exemplo.com;(11) 98888-7777;;",
    "Beatriz Rocha;beatriz@exemplo.com;;Intermediário;",
  ]
    .map((linha) => `${linha}\r\n`)
    .join("");

const MENSAGEM: Record<string, string> = {
  PLANILHA_SEM_CABECALHO:
    "A primeira linha precisa ser o cabeçalho, com pelo menos as colunas `nome` e `email`. Baixe o modelo abaixo.",
  PLANILHA_VAZIA:
    "A planilha tem cabeçalho e nenhum aluno. Preencha ao menos uma linha.",
};

function contador(n: number): string {
  if (n === 0) return "Nenhum convite por e-mail vai sair.";
  if (n === 1) return "1 convite por e-mail vai sair.";
  return `${n} convites por e-mail vão sair.`;
}

export function ImportarAlunos() {
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [relatorio, setRelatorio] = useState<RelatorioDeImportacao | null>(
    null,
  );
  const [concluida, setConcluida] = useState<ImportacaoConcluida | null>(null);
  // Os números de linha da PLANILHA (os de `linhas[].linha`), que é o que o
  // campo `convidar` leva ao Back.
  const [convidar, setConvidar] = useState<ReadonlySet<number>>(new Set());
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  function escolher(evento: ChangeEvent<HTMLInputElement>) {
    setArquivo(evento.target.files?.[0] ?? null);
    // Trocar o arquivo apaga o relatório do anterior. Deixá-lo na tela faria
    // o gestor importar um arquivo tendo conferido outro. As marcas vão junto:
    // a linha 5 do arquivo novo é outra pessoa.
    setRelatorio(null);
    setConcluida(null);
    setConvidar(new Set());
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
      // Conferir de novo recomeça a escolha: as caixas começam desmarcadas
      // (D5), inclusive na segunda conferência do mesmo arquivo.
      setConvidar(new Set());
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
      setConcluida(
        await importarPlanilha(
          arquivo,
          [...convidar].sort((a, b) => a - b),
        ),
      );
      setRelatorio(null);
      setConvidar(new Set());
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

  function alternar(linha: number) {
    setConvidar((atual) => {
      const novo = new Set(atual);
      if (novo.has(linha)) novo.delete(linha);
      else novo.add(linha);
      return novo;
    });
  }

  const semErros = relatorio !== null && relatorio.erros.length === 0;
  const linhas = semErros ? relatorio.linhas : [];

  const comSenha: AlunoImportado[] = [];
  const convidados: AlunoImportado[] = [];
  for (const c of concluida?.criados ?? []) {
    if (c.convite) convidados.push(c);
    else comSenha.push(c);
  }

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

        {/*
          SPEC-083/D5 — a escolha de quem recebe convite. Só depois de conferir
          SEM erro: com erro nada é importado, e marcar caixas de um arquivo
          que vai ser corrigido seria trabalho perdido.
        */}
        {linhas.length > 0 ? (
          <div className="flex flex-col gap-3 rounded-xl border border-border p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm font-semibold" data-testid="contador-de-convites">
                {contador(convidar.size)}
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={ocupado}
                  onClick={() =>
                    setConvidar(new Set(linhas.map((l) => l.linha)))
                  }
                  className="h-8 px-3 text-[12px] font-semibold"
                >
                  Marcar todas
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={ocupado}
                  onClick={() => setConvidar(new Set())}
                  className="h-8 px-3 text-[12px] font-semibold"
                >
                  Desmarcar todas
                </Button>
              </div>
            </div>
            <p className="text-xs text-[var(--color-on-surface-variant)]">
              Quem for marcado recebe por e-mail um link para criar a própria
              senha. Quem não for marcado recebe uma senha temporária, que
              aparece aqui depois de importar.
            </p>
            <ul className="flex flex-col divide-y divide-border">
              {linhas.map((l) => (
                <li
                  key={l.linha}
                  className="flex flex-wrap items-center justify-between gap-2 py-2 text-xs"
                >
                  <span>
                    <strong>Linha {l.linha}</strong> · {l.nome} · {l.email}
                    {l.turmaNome ? ` · ${l.turmaNome}` : ""}
                  </span>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={convidar.has(l.linha)}
                      onChange={() => alternar(l.linha)}
                      disabled={ocupado}
                      aria-label={`enviar convite por e-mail — linha ${l.linha}, ${l.email}`}
                    />
                    enviar convite por e-mail
                  </label>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {concluida ? (
          <div className="flex flex-col gap-2 rounded-xl border border-[var(--color-primary)] p-4">
            <p className="text-sm font-semibold text-[var(--color-primary)]">
              {concluida.criados.length} aluno
              {concluida.criados.length === 1 ? "" : "s"} importado
              {concluida.criados.length === 1 ? "" : "s"}.
            </p>
            {comSenha.length > 0 ? (
              <>
                {/* **O aviso vem ANTES da lista, não depois.** Depois de
                    fechar a página é tarde: nenhuma rota devolve estas senhas
                    de novo. */}
                <p className="text-xs font-semibold text-[var(--color-error)]">
                  Copie as senhas agora. Elas aparecem uma única vez — depois
                  só dá para gerar outra, aluno por aluno.
                </p>
                <ul className="flex flex-col gap-1">
                  {comSenha.map((c) => (
                    <li key={c.alunoId} className="font-mono text-xs">
                      {c.email} · {c.senhaTemporaria}
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
            {convidados.length > 0 ? (
              <ul
                className="flex flex-col gap-1"
                aria-label="Convites por e-mail"
              >
                {convidados.map((c) =>
                  c.convite?.email === "enviado" ? (
                    <li key={c.alunoId} className="text-xs">
                      <span className="font-mono">{c.email}</span> · convite
                      enviado
                    </li>
                  ) : (
                    <li
                      key={c.alunoId}
                      className="text-xs text-[var(--color-error)]"
                    >
                      <span className="font-mono">{c.email}</span> · falhou
                      {c.convite?.motivo
                        ? ` (${MOTIVO_DO_ENVIO[c.convite.motivo]})`
                        : ""}
                      . A conta foi criada: reenvie o convite ou gere uma senha
                      temporária na{" "}
                      {/* D10 — o caminho para o "falhou" é a ficha, onde
                          moram o reenviar e o gerar senha temporária. */}
                      <Link
                        href={`/pessoas/alunos/${c.alunoId}`}
                        className="font-semibold underline"
                      >
                        ficha do aluno
                      </Link>
                      .
                    </li>
                  ),
                )}
              </ul>
            ) : null}
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
