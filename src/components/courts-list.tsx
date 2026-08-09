"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/status-badge";
import { ApiError, listCourts, type Court } from "@/lib/api-client";

const PAGE_SIZE = 20;

export function CourtsList() {
  const [data, setData] = useState<Court[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (targetPage: number) => {
    setLoading(true);
    setError(null);
    try {
      const result = await listCourts(targetPage, PAGE_SIZE);
      setData(result.data);
      setTotal(result.total);
      setPage(result.page);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível carregar as quadras.");
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
          Quadras
        </h1>
        <Button asChild className="h-10 gap-2 px-5 text-[13px] font-semibold">
          <Link href="/quadras/novo">
            <Plus className="size-[18px]" />
            Nova quadra
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
        <p className="text-[var(--color-on-surface-variant)]">Nenhuma quadra cadastrada ainda.</p>
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
                    Esporte
                  </TableHead>
                  <TableHead className="text-xs font-medium tracking-wider text-[var(--color-on-surface-variant)] uppercase">
                    Preço/hora
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
                {data.map((quadra) => (
                  <TableRow key={quadra.id} className="border-border">
                    <TableCell className="font-medium text-[var(--color-on-surface)]">{quadra.nome}</TableCell>
                    <TableCell className="text-[var(--color-on-surface-variant)]">{quadra.esporte}</TableCell>
                    <TableCell className="text-[var(--color-on-surface-variant)]">
                      {quadra.precoHora.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </TableCell>
                    <TableCell>
                      <StatusBadge ativo={quadra.status === "ativa"} activeLabel="Ativa" inactiveLabel="Inativa" />
                    </TableCell>
                    <TableCell className="text-right">
                      <Link href={`/quadras/${quadra.id}`} className="text-[13px] font-medium text-primary hover:underline">
                        Gerenciar
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
