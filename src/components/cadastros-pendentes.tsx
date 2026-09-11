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
  /**
   * SPEC-049/AC-009 — **o total do SERVIDOR, e não `pendentes.length`.**
   *
   * O card mostrava o tamanho da página como se fosse o total. Com a página
   * travada em 100, ele dizia **"(100)"** para 340 esperando — um número errado
   * apresentado como fato — e o servidor **sempre mandou `total`** na mesma
   * resposta. A tela ignorava.
   */
  const [total, setTotal] = useState(0);
  const [pagina, setPagina] = useState(1);
  const [paginas, setPaginas] = useState(1);
  const [erro, setErro] = useState<string | null>(null);
  const [processando, setProcessando] = useState<string | null>(null);

  const carregar = useCallback(async (p: number) => {
    try {
      const res = await listStudentsPendentes(p);
      setPendentes(res.data);
      setTotal(res.total);
      // `Paginated` não traz `totalPages` — o cliente calcula, como a lista
      // de alunos já faz. `Math.max(1, ...)` porque zero páginas não existe:
      // fila vazia é uma página vazia, e o card some por outro caminho.
      setPaginas(Math.max(1, Math.ceil(res.total / res.pageSize)));
      // **A página volta para o que o servidor devolveu**, não para o que foi
      // pedido: aprovar o último da página 5 pode deixar só 4 páginas, e
      // insistir na 5 mostraria uma lista vazia com "há 340 esperando".
      setPagina(res.page);
    } catch {
      // Fila é informação secundária nesta tela: se falhar, a listagem de
      // alunos continua útil e não vale bloquear a página com erro.
      setPendentes([]);
      setTotal(0);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void carregar(1);
  }, [carregar]);

  async function decidir(aluno: Student, decisao: "aprovar" | "recusar") {
    setErro(null);
    setProcessando(aluno.id);
    try {
      await (decisao === "aprovar"
        ? aprovarAluno(aluno.id)
        : recusarAluno(aluno.id));
      // AC-011 — recarrega a página ATUAL, e a contagem acompanha. Voltar
      // para a primeira faria o gestor perder o lugar no meio de uma leva.
      await carregar(pagina);
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
          Cadastros aguardando aprovação ({total})
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

      {/*
        SPEC-049/AC-010 — **a paginação, para ninguém ficar inalcançável.**

        A ordem do servidor é `createdAt: 'desc'`, então sem isto quem sumia
        eram justamente **os mais antigos** — quem esperou mais. Mesmo molde da
        lista de alunos, que já funcionava a uma seção de distância.
      */}
      {paginas > 1 ? (
        <div className="mt-4 flex items-center justify-end gap-3 text-sm">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pagina <= 1}
            onClick={() => void carregar(pagina - 1)}
          >
            Anterior
          </Button>
          <span className="text-[var(--color-on-surface-variant)]">
            Página {pagina} de {paginas}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pagina >= paginas}
            onClick={() => void carregar(pagina + 1)}
          >
            Próxima
          </Button>
        </div>
      ) : null}

      {erro ? (
        <p role="alert" className="mt-3 text-sm text-[var(--color-error)]">
          {erro}
        </p>
      ) : null}
    </section>
  );
}
