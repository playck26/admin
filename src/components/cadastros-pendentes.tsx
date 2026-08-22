"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  ApiError,
  aprovarAluno,
  listStudentsPendentes,
  recusarAluno,
  type Student,
} from "@/lib/api-client";

/**
 * SPEC-009/REQ-008 (AC-015) — fila de aprovação.
 *
 * Quem chega pelo link público de auto-cadastro nasce `pendente`: entra no
 * app e olha, mas não reserva quadra nem entra em turma até alguém da
 * empresa aprovar (INV-010). Esta é a tela onde isso acontece.
 *
 * A seção some quando não há pendentes — fila vazia não é informação útil
 * ocupando o topo da listagem todo dia.
 */
export function CadastrosPendentes({ onDecidir }: { onDecidir: () => void }) {
  const [pendentes, setPendentes] = useState<Student[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [processando, setProcessando] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    try {
      const res = await listStudentsPendentes();
      setPendentes(res.data);
    } catch {
      // Fila é informação secundária nesta tela: se falhar, a listagem de
      // alunos continua útil e não vale bloquear a página com erro.
      setPendentes([]);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void carregar();
  }, [carregar]);

  async function decidir(aluno: Student, decisao: "aprovar" | "recusar") {
    setErro(null);
    setProcessando(aluno.id);
    try {
      await (decisao === "aprovar"
        ? aprovarAluno(aluno.id)
        : recusarAluno(aluno.id));
      await carregar();
      onDecidir();
    } catch (err) {
      setErro(
        err instanceof ApiError
          ? err.message
          : "Não foi possível concluir a ação.",
      );
    } finally {
      setProcessando(null);
    }
  }

  if (pendentes.length === 0) return null;

  return (
    <section className="mb-6 rounded-xl border border-[var(--color-outline)] bg-[var(--color-surface)] p-5">
      <div className="mb-4">
        <h2 className="text-base font-semibold">
          Cadastros aguardando aprovação ({pendentes.length})
        </h2>
        <p className="text-sm text-[var(--color-on-surface-variant)]">
          Pessoas que se cadastraram pelo link público. Até aprovar, elas não
          reservam quadra nem entram em turma.
        </p>
      </div>

      <ul className="flex flex-col gap-3">
        {pendentes.map((aluno) => (
          <li
            key={aluno.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-[var(--color-surface-variant)] px-4 py-3"
          >
            <div>
              <p className="font-medium">{aluno.nome}</p>
              <p className="text-sm text-[var(--color-on-surface-variant)]">
                {aluno.email}
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={processando === aluno.id}
                onClick={() => void decidir(aluno, "recusar")}
              >
                Recusar
              </Button>
              <Button
                type="button"
                disabled={processando === aluno.id}
                onClick={() => void decidir(aluno, "aprovar")}
              >
                Aprovar
              </Button>
            </div>
          </li>
        ))}
      </ul>

      {erro ? (
        <p role="alert" className="mt-3 text-sm text-[var(--color-error)]">
          {erro}
        </p>
      ) : null}
    </section>
  );
}
