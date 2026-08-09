"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FormCard } from "@/components/form-card";
import { ApiError, createLevel, deleteLevel, listLevels, type Level } from "@/lib/api-client";

export function LevelsManager() {
  const [levels, setLevels] = useState<Level[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [nome, setNome] = useState("");
  const [ordem, setOrdem] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setLevels(await listLevels());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível carregar os níveis.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreateError(null);
    setCreating(true);
    try {
      await createLevel({ nome, ordem: Number(ordem) });
      setNome("");
      setOrdem("");
      await load();
    } catch (err) {
      setCreateError(err instanceof ApiError ? err.message : "Não foi possível criar o nível.");
    } finally {
      setCreating(false);
    }
  }

  async function handleRemove(id: string) {
    setRemovingId(id);
    setError(null);
    try {
      await deleteLevel(id);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível remover o nível.");
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-6 py-6">
      <h1 className="text-[28px] leading-[34px] font-bold tracking-[-0.02em] text-[var(--color-on-surface)]">
        Níveis
      </h1>

      <FormCard
        title="Novo nível"
        description="Nomenclatura livre — use o mesmo nome que a escola já usa"
        className="max-w-md"
      >
        <form onSubmit={handleCreate} className="flex flex-col gap-4" noValidate>
          <div className="flex flex-col gap-2">
            <Label htmlFor="nome">Nome</Label>
            <Input
              id="nome"
              required
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              disabled={creating}
              className="h-11 px-4"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="ordem">Ordem</Label>
            <Input
              id="ordem"
              type="number"
              required
              value={ordem}
              onChange={(e) => setOrdem(e.target.value)}
              disabled={creating}
              className="h-11 px-4"
            />
          </div>
          {createError ? (
            <p role="alert" className="text-sm text-[var(--color-error)]">
              {createError}
            </p>
          ) : null}
          <Button type="submit" disabled={creating} className="mt-2 h-11 text-[13px] font-semibold">
            {creating ? "Criando..." : "Criar nível"}
          </Button>
        </form>
      </FormCard>

      {loading ? (
        <p className="text-[var(--color-on-surface-variant)]">Carregando...</p>
      ) : error ? (
        <p role="alert" className="text-[var(--color-error)]">
          {error}
        </p>
      ) : levels.length === 0 ? (
        <p className="text-[var(--color-on-surface-variant)]">Nenhum nível cadastrado ainda.</p>
      ) : (
        <div className="max-w-md overflow-hidden rounded-2xl border border-border bg-[var(--color-surface-container-lowest)] shadow-[var(--shadow-low)]">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-xs font-medium tracking-wider text-[var(--color-on-surface-variant)] uppercase">
                  Ordem
                </TableHead>
                <TableHead className="text-xs font-medium tracking-wider text-[var(--color-on-surface-variant)] uppercase">
                  Nome
                </TableHead>
                <TableHead className="text-right text-xs font-medium tracking-wider text-[var(--color-on-surface-variant)] uppercase">
                  Ações
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {levels.map((nivel) => (
                <TableRow key={nivel.id} className="border-border">
                  <TableCell className="text-[var(--color-on-surface-variant)]">{nivel.ordem}</TableCell>
                  <TableCell className="font-medium text-[var(--color-on-surface)]">{nivel.nome}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={removingId === nivel.id}
                      onClick={() => void handleRemove(nivel.id)}
                      className="text-[13px] font-medium text-[var(--color-error)] hover:bg-[var(--color-error)]/10 hover:text-[var(--color-error)]"
                    >
                      {removingId === nivel.id ? "Removendo..." : "Remover"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
