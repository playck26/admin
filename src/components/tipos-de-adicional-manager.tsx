"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FormCard } from "@/components/form-card";
import {
  ApiError,
  apagarTipoDeAdicional,
  criarTipoDeAdicional,
  editarTipoDeAdicional,
  listarTiposDeAdicional,
  type TipoDeAdicional,
} from "@/lib/api-client";

/**
 * SPEC-054/D12 — **os tipos de adicional** ("Raquetes", "Bolas"): o catálogo
 * livre do clube. O gestor dá nome; cobrança, trava e devolução são do
 * comportamento Adicional, que é código.
 *
 * **O `422 TIPO_EM_USO` é informação, não falha** — no molde da SPEC-020: a
 * mensagem do servidor diz quantos adicionais usam o tipo e o que fazer antes,
 * e é exibida como veio.
 */
export function TiposDeAdicionalManager() {
  const [tipos, setTipos] = useState<TipoDeAdicional[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [nome, setNome] = useState("");
  const [criando, setCriando] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [nomeEditado, setNomeEditado] = useState("");
  const [ocupadoId, setOcupadoId] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      setTipos(await listarTiposDeAdicional());
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : "Não foi possível carregar os tipos.");
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void carregar();
  }, [carregar]);

  async function criar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setErro(null);
    setCriando(true);
    try {
      // A ordem nova vai para o fim — o que se espera de "acrescentar".
      await criarTipoDeAdicional({ nome: nome.trim(), ordem: tipos.length });
      setNome("");
      await carregar();
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : "Não foi possível criar o tipo.");
    } finally {
      setCriando(false);
    }
  }

  async function renomear(evento: FormEvent<HTMLFormElement>, id: string) {
    evento.preventDefault();
    setErro(null);
    setOcupadoId(id);
    try {
      await editarTipoDeAdicional(id, { nome: nomeEditado.trim() });
      setEditandoId(null);
      await carregar();
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : "Não foi possível renomear o tipo.");
    } finally {
      setOcupadoId(null);
    }
  }

  async function apagar(id: string) {
    setErro(null);
    setOcupadoId(id);
    try {
      await apagarTipoDeAdicional(id);
      await carregar();
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : "Não foi possível apagar o tipo.");
    } finally {
      setOcupadoId(null);
    }
  }

  return (
    <FormCard
      title="Tipos de adicional"
      description="Como o clube agrupa o que aluga junto com a reserva: raquetes, bolas, toalhas."
    >
      <form onSubmit={(e) => void criar(e)} className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex flex-1 flex-col gap-2">
          <Label htmlFor="nome-tipo">Nome do tipo</Label>
          <Input
            id="nome-tipo"
            required
            maxLength={30}
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Raquetes"
            disabled={criando}
            className="h-11 px-4"
          />
        </div>
        <Button type="submit" disabled={criando || nome.trim() === ""} className="h-11">
          {criando ? "Adicionando..." : "Adicionar"}
        </Button>
      </form>

      {erro ? (
        <p role="alert" className="mt-3 text-sm font-semibold text-[var(--color-error)]">
          {erro}
        </p>
      ) : null}

      <div className="mt-6">
        {carregando ? (
          <p className="text-sm text-[var(--color-on-surface-variant)]">Carregando...</p>
        ) : tipos.length === 0 ? (
          <p className="text-sm text-[var(--color-on-surface-variant)]">
            Nenhum tipo ainda. Crie o primeiro acima — todo adicional pertence a um tipo.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead className="w-32 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tipos.map((tipo) => (
                <TableRow key={tipo.id}>
                  <TableCell className="font-semibold">
                    {editandoId === tipo.id ? (
                      <form onSubmit={(e) => void renomear(e, tipo.id)} className="flex gap-2">
                        <Input
                          aria-label={`Novo nome de ${tipo.nome}`}
                          required
                          maxLength={30}
                          value={nomeEditado}
                          onChange={(e) => setNomeEditado(e.target.value)}
                          className="h-9 px-3"
                        />
                        <Button
                          type="submit"
                          size="sm"
                          disabled={ocupadoId === tipo.id || nomeEditado.trim() === ""}
                        >
                          Salvar nome
                        </Button>
                      </form>
                    ) : (
                      tipo.nome
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        aria-label={`Renomear ${tipo.nome}`}
                        onClick={() => {
                          setEditandoId(tipo.id);
                          setNomeEditado(tipo.nome);
                        }}
                      >
                        <Pencil className="size-4" aria-hidden="true" />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        aria-label={`Apagar ${tipo.nome}`}
                        disabled={ocupadoId === tipo.id}
                        onClick={() => void apagar(tipo.id)}
                      >
                        <Trash2 className="size-4" aria-hidden="true" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </FormCard>
  );
}
