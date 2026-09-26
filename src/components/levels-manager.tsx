"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FormCard } from "@/components/form-card";
import {
  ApiError,
  createLevel,
  deleteLevel,
  listLevels,
  updateLevel,
  type Level,
} from "@/lib/api-client";

/**
 * SPEC-075/D1 — **o primeiro nível**: menor `ordem`, depois menor
 * `createdAt`, depois menor `id` — a mesma ordem que o servidor usa para
 * decidir o nível de quem ainda não foi classificado
 * (`src/people/nivel-efetivo.ts` do Back). Aqui é só para a FRASE da tela
 * (D8): quem decide o acesso é o servidor, e a tela nunca recusa nada por isso.
 * A lista chega ordenada só por `ordem`, e empate de `ordem` é permitido — sem o
 * desempate, a frase podia nomear um nível que não é o que o servidor usa.
 */
export function primeiroNivel(niveis: readonly Level[]): Level | null {
  let primeiro: Level | null = null;
  for (const n of niveis) {
    if (
      primeiro === null ||
      n.ordem < primeiro.ordem ||
      (n.ordem === primeiro.ordem &&
        (n.createdAt < primeiro.createdAt ||
          (n.createdAt === primeiro.createdAt && n.id < primeiro.id)))
    ) {
      primeiro = n;
    }
  }
  return primeiro;
}

export function LevelsManager() {
  const [levels, setLevels] = useState<Level[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [nome, setNome] = useState("");
  const [ordem, setOrdem] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  // SPEC-075/D8 — editar nome e ordem, na própria linha. "Editável" era a
  // palavra da decisão 4 do Israel, e antes desta tela só dava para apagar e
  // criar de novo — o que o servidor recusa quando o nível está em uso.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNome, setEditNome] = useState("");
  const [editOrdem, setEditOrdem] = useState("");
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

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

  function startEdit(nivel: Level) {
    setEditingId(nivel.id);
    setEditNome(nivel.nome);
    setEditOrdem(String(nivel.ordem));
    setEditError(null);
  }

  async function handleSave(id: string) {
    setSaving(true);
    setEditError(null);
    try {
      await updateLevel(id, { nome: editNome, ordem: Number(editOrdem) });
      setEditingId(null);
      await load();
    } catch (err) {
      // A recusa do servidor aparece inteira: nome repetido, ou — SPEC-075/D12 —
      // a reordenação que deixaria um aluno sem nível fora do nível de uma turma
      // em que ele está (a mensagem diz quem e o que fazer).
      setEditError(err instanceof ApiError ? err.message : "Não foi possível salvar o nível.");
    } finally {
      setSaving(false);
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

  const primeiro = primeiroNivel(levels);

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
        <div className="flex max-w-md flex-col gap-3">
        {primeiro ? (
          // SPEC-075/D8 — sem esta frase, o gestor não sabe que reordenar muda
          // o acesso de quem ainda não foi classificado.
          <p className="text-sm text-[var(--color-on-surface-variant)]">
            O primeiro da ordem, <strong className="text-[var(--color-on-surface)]">{primeiro.nome}</strong>, vale
            para quem ainda não foi classificado: o aluno sem nível conta como {primeiro.nome}, e só entra nas
            turmas desse nível ou nas que não têm nível.
          </p>
        ) : null}
        {editError ? (
          <p role="alert" className="text-sm text-[var(--color-error)]">
            {editError}
          </p>
        ) : null}
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
              {levels.map((nivel) =>
                editingId === nivel.id ? (
                  <TableRow key={nivel.id} className="border-border">
                    <TableCell>
                      <Input
                        aria-label={`Ordem de ${nivel.nome}`}
                        type="number"
                        value={editOrdem}
                        onChange={(e) => setEditOrdem(e.target.value)}
                        disabled={saving}
                        className="h-9 w-20 px-2"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        aria-label={`Nome de ${nivel.nome}`}
                        value={editNome}
                        onChange={(e) => setEditNome(e.target.value)}
                        disabled={saving}
                        className="h-9 px-2"
                      />
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      <Button
                        type="button"
                        disabled={saving}
                        onClick={() => void handleSave(nivel.id)}
                        className="h-9 text-[13px] font-semibold"
                      >
                        {saving ? "Salvando..." : "Salvar"}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        disabled={saving}
                        onClick={() => {
                          setEditingId(null);
                          setEditError(null);
                        }}
                        className="h-9 text-[13px] font-medium"
                      >
                        Cancelar
                      </Button>
                    </TableCell>
                  </TableRow>
                ) : (
                <TableRow key={nivel.id} className="border-border">
                  <TableCell className="text-[var(--color-on-surface-variant)]">{nivel.ordem}</TableCell>
                  <TableCell className="font-medium text-[var(--color-on-surface)]">{nivel.nome}</TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={editingId !== null}
                      onClick={() => startEdit(nivel)}
                      className="text-[13px] font-medium"
                    >
                      Editar
                    </Button>
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
                ),
              )}
            </TableBody>
          </Table>
        </div>
        </div>
      )}
    </div>
  );
}
