"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-foreground">Alunos</h1>
        <Button asChild>
          <Link href="/pessoas/alunos/novo">Novo aluno</Link>
        </Button>
      </div>

      {loading ? (
        <p className="text-[var(--color-text-secondary)]">Carregando...</p>
      ) : error ? (
        <p role="alert" className="text-[var(--color-error)]">
          {error}
        </p>
      ) : data.length === 0 ? (
        <p className="text-[var(--color-text-secondary)]">Nenhum aluno cadastrado ainda.</p>
      ) : (
        <>
          <div className="overflow-x-auto rounded-[var(--radius)] border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((aluno) => (
                  <TableRow key={aluno.id}>
                    <TableCell className="font-medium">{aluno.nome}</TableCell>
                    <TableCell>{aluno.email}</TableCell>
                    <TableCell>
                      <Badge variant={aluno.status === "ativo" ? "default" : "secondary"}>
                        {aluno.status === "ativo" ? "Ativo" : "Inativo"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Link
                        href={`/pessoas/alunos/${aluno.id}`}
                        className="text-sm font-medium text-[var(--color-primary)] hover:underline"
                      >
                        Editar
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {totalPages > 1 ? (
            <div className="flex items-center justify-end gap-2">
              <Button variant="outline" disabled={page <= 1} onClick={() => void load(page - 1)}>
                Anterior
              </Button>
              <span className="text-sm text-[var(--color-text-secondary)]">
                Página {page} de {totalPages}
              </span>
              <Button variant="outline" disabled={page >= totalPages} onClick={() => void load(page + 1)}>
                Próxima
              </Button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
