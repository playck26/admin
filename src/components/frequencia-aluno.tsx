"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getFrequenciaDoAluno, type FrequenciaDoAluno } from "@/lib/api-client";
import { Badge } from "@/components/ui/badge";

/**
 * SPEC-015/TASK-004 — o bloco de frequência na tela do aluno.
 *
 * **AC-007: o agregado nunca aparece sozinho.** Um número somando turmas
 * esconde exatamente o caso que o gestor precisa ver — o aluno que vai bem
 * numa turma e sumiu da outra sai "mediano" no total. A quebra por turma
 * fica logo abaixo, sempre, e é ela que carrega a informação.
 */
export function FrequenciaAluno({ alunoId }: { alunoId: string }) {
  const [dados, setDados] = useState<FrequenciaDoAluno | null>(null);
  const [erro, setErro] = useState(false);

  useEffect(() => {
    let vivo = true;
    getFrequenciaDoAluno(alunoId, 30)
      .then((d) => vivo && setDados(d))
      .catch(() => vivo && setErro(true));
    return () => {
      vivo = false;
    };
  }, [alunoId]);

  // Mesma razão do cartão de evasão: seção que some é falha silenciosa, e
  // quem abriu a ficha do aluno costuma ter vindo de um alerta.
  if (erro) {
    return (
      <p className="text-sm text-[var(--color-error)]">
        Não foi possível carregar a frequência deste aluno. Recarregue a página.
      </p>
    );
  }
  if (!dados) {
    return (
      <p className="text-sm text-[var(--color-on-surface-variant)]">
        Carregando frequência…
      </p>
    );
  }

  const { agregado, porTurma } = dados;

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold text-[var(--color-on-surface)]">
          Frequência
        </h2>
        <span className="text-xs text-[var(--color-on-surface-variant)]">
          últimos {dados.janelaDias} dias
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-4 rounded-xl border border-border p-4">
        <div>
          <p className="text-3xl font-semibold tabular-nums text-[var(--color-on-surface)]">
            {agregado.frequenciaPct === null ? "—" : `${agregado.frequenciaPct}%`}
          </p>
          <p className="text-xs text-[var(--color-on-surface-variant)]">
            {agregado.base === 0
              ? "sem registro no período"
              : `sobre ${agregado.base} chamada${agregado.base > 1 ? "s" : ""}`}
          </p>
        </div>
        {/* O limiar é o da régua (INV-023: 3), o MESMO da quebra por turma
            logo abaixo. Alarmar a partir de 1 fazia a mesma tela dizer
            "1 faltas seguidas" em vermelho no topo e nada na linha da
            turma — duas afirmações contraditórias sobre o mesmo aluno. */}
        {agregado.faltasSeguidas >= 3 ? (
          <Badge variant="destructive">
            {agregado.faltasSeguidas} faltas seguidas
          </Badge>
        ) : null}
        {agregado.confianca === "baixa" && agregado.base > 0 ? (
          <Badge variant="outline" title="Poucas chamadas completas no período">
            dado parcial
          </Badge>
        ) : null}
      </div>

      {/* AC-007 — a quebra vem SEMPRE, e é o que o agregado esconderia. */}
      <ul className="flex flex-col divide-y divide-border rounded-xl border border-border">
        {porTurma.map((t) => (
          <li
            key={t.turmaId}
            className="flex flex-wrap items-center justify-between gap-2 p-3"
          >
            <div className="min-w-0">
              <Link
                href={`/turmas/${t.turmaId}`}
                className="text-sm font-medium text-[var(--color-on-surface)] hover:text-primary hover:underline"
              >
                {t.turmaNome ?? "Turma"}
              </Link>
              {!t.naTurmaHoje ? (
                <Badge variant="outline" className="ml-2">
                  saiu da turma
                </Badge>
              ) : null}
              <p className="text-xs text-[var(--color-on-surface-variant)]">
                {t.presente} veio · {t.ausente} faltou · {t.justificado} justificou
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="tabular-nums text-sm text-[var(--color-on-surface)]">
                {t.frequenciaPct === null ? "—" : `${t.frequenciaPct}%`}
              </span>
              {t.faltasSeguidas >= 3 ? (
                <Badge variant="destructive">{t.faltasSeguidas} seguidas</Badge>
              ) : null}
            </div>
          </li>
        ))}
      </ul>

      {porTurma.length === 0 ? (
        <p className="text-sm text-[var(--color-on-surface-variant)]">
          Este aluno não está em nenhuma turma nem tem registro no período.
        </p>
      ) : null}
    </section>
  );
}
