"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { getEvasao, type ListaDeEvasao } from "@/lib/api-client";
import { Badge } from "@/components/ui/badge";

/**
 * SPEC-015/TASK-004 — o cartão "alunos em risco" do dashboard.
 *
 * **É a única tela desta spec que puxa o gestor para uma ação**, e por isso
 * cada item é clicável para o aluno E para a turma (AC-012): o alerta
 * sozinho não resolve nada — quem resolve é a conversa, e para conversar
 * ele precisa chegar na pessoa.
 *
 * O que a tela NÃO faz, de propósito: registrar "aluno contatado". Isso
 * viraria estado sem dono, e está fora de escopo por decisão da spec.
 */
export function EvasaoCard() {
  const [dados, setDados] = useState<ListaDeEvasao | null>(null);
  const [erro, setErro] = useState(false);

  useEffect(() => {
    let vivo = true;
    getEvasao(30)
      .then((d) => vivo && setDados(d))
      .catch(() => vivo && setErro(true));
    return () => {
      vivo = false;
    };
  }, []);

  // Sumir com o cartão numa falha faria 500 e "ninguém em risco" ficarem
  // idênticos na tela — e o segundo é boa notícia. A AC-008 quer o cartão
  // sempre desenhado justamente para o gestor saber que a régua rodou.
  if (erro) {
    return (
      <div className="rounded-2xl border border-border bg-[var(--color-surface-container-lowest)] p-6">
        <div className="flex items-center gap-2">
          <AlertTriangle className="size-5 text-[var(--color-on-surface-variant)]" />
          <h2 className="text-lg font-semibold text-[var(--color-on-surface)]">
            Alunos em risco
          </h2>
        </div>
        <p className="mt-3 text-sm text-[var(--color-error)]">
          Não foi possível carregar os alunos em risco. Isto não quer dizer que
          não há nenhum — recarregue a página.
        </p>
      </div>
    );
  }
  if (!dados) {
    return (
      <div className="rounded-2xl border border-border bg-[var(--color-surface-container-lowest)] p-6">
        <p className="text-sm text-[var(--color-on-surface-variant)]">
          Carregando alunos em risco…
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-[var(--color-surface-container-lowest)] p-6 shadow-[var(--shadow-low)]">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <AlertTriangle
            className={`size-5 ${
              dados.total > 0
                ? "text-[var(--color-error)]"
                : "text-[var(--color-on-surface-variant)]"
            }`}
          />
          <h2 className="text-lg font-semibold text-[var(--color-on-surface)]">
            Alunos em risco
          </h2>
        </div>
        <span className="text-sm text-[var(--color-on-surface-variant)]">
          últimos {dados.janelaDias} dias
        </span>
      </div>

      {/* AC-008 — a forma vazia é um estado normal, não um erro. O cartão
          fica na tela para o gestor saber que a régua está rodando. */}
      {dados.total === 0 ? (
        <p className="mt-4 text-sm text-[var(--color-on-surface-variant)]">
          Ninguém em risco no período. A régua é de 3 faltas seguidas ou
          frequência abaixo de 60%.
        </p>
      ) : (
        <ul className="mt-4 flex flex-col divide-y divide-border">
          {dados.alunos.map((a) => (
            <li
              key={`${a.alunoId}:${a.turmaId}`}
              className="flex flex-wrap items-center justify-between gap-2 py-3"
            >
              <div className="min-w-0">
                <Link
                  href={`/pessoas/alunos/${a.alunoId}`}
                  className="font-medium text-[var(--color-on-surface)] hover:text-primary hover:underline"
                >
                  {a.nome}
                </Link>
                <p className="text-xs text-[var(--color-on-surface-variant)]">
                  em{" "}
                  <Link
                    href={`/turmas/${a.turmaId}`}
                    className="hover:text-primary hover:underline"
                  >
                    {a.turmaNome ?? "turma"}
                  </Link>
                </p>
              </div>

              <div className="flex items-center gap-2 text-sm">
                {a.motivo === "faltas_seguidas" ? (
                  // A composição vai junto: "5 seguidas, 2 justificadas" é
                  // outra conversa que "5 faltas".
                  <Badge variant="destructive">
                    {a.faltasSeguidas} faltas seguidas
                    {a.faltasSeguidasComposicao.justificado > 0
                      ? ` (${a.faltasSeguidasComposicao.justificado} just.)`
                      : ""}
                  </Badge>
                ) : (
                  <Badge variant="destructive">{a.frequenciaPct}% de presença</Badge>
                )}
                {a.confianca === "baixa" ? (
                  <Badge variant="outline" title="A turma tem pouca chamada completa no período">
                    dado parcial
                  </Badge>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
