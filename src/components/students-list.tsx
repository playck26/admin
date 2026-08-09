"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/status-badge";
import { ApiError, listStudents, type Student } from "@/lib/api-client";

const PAGE_SIZE = 20;

export function StudentsList() {
  const [data, setData] = useState<Student[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (targetPage: number) => {
    setLoading(true);
    setError(null);
    try {
      const result = await listStudents(targetPage, PAGE_SIZE);
      setData(result.data);
      setTotal(result.total);
      setPage(result.page);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível carregar os alunos.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load(1);
  }, [load]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="flex flex-col gap-6 py-6">
      <div className="flex items-center justify-between">
        <h1 className="text-[28px] leading-[34px] font-bold tracking-[-0.02em] text-[var(--color-on-surface)]">
          Alunos
        </h1>
        <Button asChild className="h-10 gap-2 px-5 text-[13px] font-semibold">
          <Link href="/pessoas/alunos/novo">
            <Plus className="size-[18px]" />
            Novo aluno
          </Link>
        </Button>
      </div>

      {loading ? (
        <p className="text-[var(--color-on-surface-variant)]">Carregando...</p>
      ) : error ? (
        <p role="alert" className="text-[var(--color-error)]">
          {error}
        </p>
      ) : data.length === 0 ? (
        <p className="text-[var(--color-on-surface-variant)]">Nenhum aluno cadastrado ainda.</p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-[var(--color-surface-container-lowest)] shadow-[var(--shadow-low)]">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="text-xs font-medium tracking-wider text-[var(--color-on-surface-variant)] uppercase">
                    Nome
                  </TableHead>
                  <TableHead className="text-xs font-medium tracking-wider text-[var(--color-on-surface-variant)] uppercase">
                    Email
                  </TableHead>
                  <TableHead className="text-xs font-medium tracking-wider text-[var(--color-on-surface-variant)] uppercase">
                    Status
                  </TableHead>
                  <TableHead className="text-right text-xs font-medium tracking-wider text-[var(--color-on-surface-variant)] uppercase">
                    Ações
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((aluno) => (
                  <TableRow key={aluno.id} className="border-border">
                    <TableCell className="font-medium text-[var(--color-on-surface)]">{aluno.nome}</TableCell>
                    <TableCell className="text-[var(--color-on-surface-variant)]">{aluno.email}</TableCell>
                    <TableCell>
                      <StatusBadge ativo={aluno.status === "ativo"} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Link href={`/pessoas/alunos/${aluno.id}`} className="text-[13px] font-medium text-primary hover:underline">
                        Editar
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {totalPages > 1 ? (
            <div className="flex items-center justify-between border-t border-border px-6 py-4">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => void load(page - 1)}>
                Anterior
              </Button>
              <span className="text-xs text-[var(--color-on-surface-variant)]">
                Página {page} de {totalPages}
              </span>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => void load(page + 1)}>
                Próxima
              </Button>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
