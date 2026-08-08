"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-foreground">Níveis</h1>

      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-lg">Novo nível</CardTitle>
          <CardDescription>Nomenclatura livre — use o mesmo nome que a escola já usa</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="flex flex-col gap-4" noValidate>
            <div className="flex flex-col gap-2">
              <Label htmlFor="nome">Nome</Label>
              <Input
                id="nome"
                required
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                disabled={creating}
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
              />
            </div>
            {createError ? (
              <p role="alert" className="text-sm text-[var(--color-error)]">
                {createError}
              </p>
            ) : null}
            <Button type="submit" disabled={creating}>
              {creating ? "Criando..." : "Criar nível"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {loading ? (
        <p className="text-[var(--color-text-secondary)]">Carregando...</p>
      ) : error ? (
        <p role="alert" className="text-[var(--color-error)]">
          {error}
        </p>
      ) : levels.length === 0 ? (
        <p className="text-[var(--color-text-secondary)]">Nenhum nível cadastrado ainda.</p>
      ) : (
        <div className="overflow-x-auto rounded-[var(--radius)] border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ordem</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {levels.map((nivel) => (
                <TableRow key={nivel.id}>
                  <TableCell>{nivel.ordem}</TableCell>
                  <TableCell className="font-medium">{nivel.nome}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={removingId === nivel.id}
                      onClick={() => void handleRemove(nivel.id)}
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
