"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Pencil } from "lucide-react";
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
  criarAdicional,
  editarAdicional,
  listarAdicionais,
  listarTiposDeAdicional,
  type Adicional,
  type AdicionalEditado,
  type TipoDeAdicional,
} from "@/lib/api-client";

const emReais = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const dataBr = (iso: string) => {
  const [a, m, d] = iso.split("-");
  return `${d}/${m}/${a}`;
};

/**
 * SPEC-054/D12 e D13 — **o que o clube aluga junto com a reserva.**
 *
 * - **Sem botão de apagar**: tirar de oferta é desativar. O item de uma reserva
 *   aponta para o adicional e guarda o que foi cobrado.
 * - **Baixar o estoque abaixo do reservado é permitido** (D13): uma raquete
 *   quebrou e o gestor registra a realidade. As reservas feitas não mudam, e a
 *   tela mostra, depois de salvar, os horários que ficaram acima — para ele
 *   decidir o que fazer com eles.
 */
export function AdicionaisManager() {
  const [adicionais, setAdicionais] = useState<Adicional[]>([]);
  const [tipos, setTipos] = useState<TipoDeAdicional[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [acima, setAcima] = useState<AdicionalEditado | null>(null);

  const [tipoId, setTipoId] = useState("");
  const [nome, setNome] = useState("");
  const [preco, setPreco] = useState("");
  const [estoque, setEstoque] = useState("");
  const [criando, setCriando] = useState(false);

  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [edicao, setEdicao] = useState({ tipoId: "", preco: "", estoque: "" });
  const [ocupadoId, setOcupadoId] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const [lista, listaDeTipos] = await Promise.all([
        listarAdicionais(),
        listarTiposDeAdicional(),
      ]);
      setAdicionais(lista);
      setTipos(listaDeTipos);
      setTipoId((atual) => atual || listaDeTipos[0]?.id || "");
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : "Não foi possível carregar os adicionais.");
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
      await criarAdicional({
        tipoId,
        nome: nome.trim(),
        preco: Number(preco),
        estoque: Number(estoque),
      });
      setNome("");
      setPreco("");
      setEstoque("");
      await carregar();
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : "Não foi possível criar o adicional.");
    } finally {
      setCriando(false);
    }
  }

  async function salvar(evento: FormEvent<HTMLFormElement>, a: Adicional) {
    evento.preventDefault();
    setErro(null);
    setAcima(null);
    setOcupadoId(a.id);
    try {
      const editado = await editarAdicional(a.id, {
        tipoId: edicao.tipoId,
        preco: Number(edicao.preco),
        estoque: Number(edicao.estoque),
      });
      if (editado.horariosAcimaDoEstoque.length > 0) setAcima(editado);
      setEditandoId(null);
      await carregar();
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : "Não foi possível salvar o adicional.");
    } finally {
      setOcupadoId(null);
    }
  }

  async function alternarAtivo(a: Adicional) {
    setErro(null);
    setOcupadoId(a.id);
    try {
      await editarAdicional(a.id, { ativo: !a.ativo });
      await carregar();
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : "Não foi possível mudar o adicional.");
    } finally {
      setOcupadoId(null);
    }
  }

  const semTipo = !carregando && tipos.length === 0;

  return (
    <FormCard
      title="Adicionais"
      description="O que o aluno pode acrescentar à reserva, com preço e quantas unidades o clube tem."
    >
      {semTipo ? (
        <p className="text-sm text-[var(--color-on-surface-variant)]">
          Crie antes um tipo de adicional (Reservas → Tipos de adicional): todo
          adicional pertence a um.
        </p>
      ) : (
        <form onSubmit={(e) => void criar(e)} className="grid gap-3 sm:grid-cols-[1fr_1.5fr_0.8fr_0.8fr_auto] sm:items-end">
          <div className="flex flex-col gap-2">
            <Label htmlFor="adicional-tipo">Tipo</Label>
            <select
              id="adicional-tipo"
              value={tipoId}
              onChange={(e) => setTipoId(e.target.value)}
              className="h-11 rounded-lg border border-border bg-[var(--color-surface)] px-3"
            >
              {tipos.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nome}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="adicional-nome">Nome do adicional</Label>
            <Input
              id="adicional-nome"
              required
              maxLength={40}
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Raquete Wilson"
              className="h-11 px-4"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="adicional-preco">Preço (R$)</Label>
            <Input
              id="adicional-preco"
              required
              type="number"
              min="0.01"
              step="0.01"
              value={preco}
              onChange={(e) => setPreco(e.target.value)}
              className="h-11 px-4"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="adicional-estoque">Estoque</Label>
            <Input
              id="adicional-estoque"
              required
              type="number"
              min="0"
              step="1"
              value={estoque}
              onChange={(e) => setEstoque(e.target.value)}
              className="h-11 px-4"
            />
          </div>
          <Button
            type="submit"
            className="h-11"
            disabled={criando || !tipoId || nome.trim() === "" || preco === "" || estoque === ""}
          >
            {criando ? "Adicionando..." : "Adicionar"}
          </Button>
        </form>
      )}

      {erro ? (
        <p role="alert" className="mt-3 text-sm font-semibold text-[var(--color-error)]">
          {erro}
        </p>
      ) : null}

      {acima ? (
        <div role="status" className="mt-4 rounded-xl bg-[var(--color-warning)]/10 px-4 py-3 text-sm">
          <p className="font-semibold">
            {acima.nome} ficou acima do estoque em {acima.horariosAcimaDoEstoque.length}{" "}
            horário(s). As reservas feitas continuam valendo.
          </p>
          <ul className="mt-1 list-disc pl-5">
            {acima.horariosAcimaDoEstoque.map((h) => (
              <li key={`${h.data}-${h.horaInicio}`}>
                {dataBr(h.data)} {h.horaInicio}–{h.horaFim}: {h.reservado} reservadas
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-6">
        {carregando ? (
          <p className="text-sm text-[var(--color-on-surface-variant)]">Carregando...</p>
        ) : adicionais.length === 0 ? (
          <p className="text-sm text-[var(--color-on-surface-variant)]">
            Nenhum adicional ainda. O que você cadastrar aparece para o aluno na hora de reservar.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Preço</TableHead>
                <TableHead>Estoque</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {adicionais.map((a) => (
                <TableRow key={a.id} className={a.ativo ? "" : "opacity-60"}>
                  <TableCell className="font-semibold">
                    {a.nome}
                    {a.ativo ? null : (
                      <span className="ml-2 text-xs font-normal">(fora de oferta)</span>
                    )}
                  </TableCell>
                  {editandoId === a.id ? (
                    <TableCell colSpan={4}>
                      <form onSubmit={(e) => void salvar(e, a)} className="flex flex-wrap items-end gap-2">
                        <select
                          aria-label={`Tipo de ${a.nome}`}
                          value={edicao.tipoId}
                          onChange={(e) => setEdicao({ ...edicao, tipoId: e.target.value })}
                          className="h-9 rounded-lg border border-border bg-[var(--color-surface)] px-2"
                        >
                          {tipos.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.nome}
                            </option>
                          ))}
                        </select>
                        <Input
                          aria-label={`Preço de ${a.nome}`}
                          type="number"
                          min="0.01"
                          step="0.01"
                          required
                          value={edicao.preco}
                          onChange={(e) => setEdicao({ ...edicao, preco: e.target.value })}
                          className="h-9 w-28 px-2"
                        />
                        <Input
                          aria-label={`Estoque de ${a.nome}`}
                          type="number"
                          min="0"
                          step="1"
                          required
                          value={edicao.estoque}
                          onChange={(e) => setEdicao({ ...edicao, estoque: e.target.value })}
                          className="h-9 w-24 px-2"
                        />
                        <Button type="submit" size="sm" disabled={ocupadoId === a.id} aria-label={`Salvar ${a.nome}`}>
                          Salvar
                        </Button>
                        <Button type="button" size="sm" variant="outline" onClick={() => setEditandoId(null)}>
                          Voltar
                        </Button>
                      </form>
                    </TableCell>
                  ) : (
                    <>
                      <TableCell>{a.tipoNome}</TableCell>
                      <TableCell>{emReais(a.preco)}</TableCell>
                      <TableCell>{a.estoque}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            aria-label={`Editar ${a.nome}`}
                            onClick={() => {
                              setEditandoId(a.id);
                              setEdicao({
                                tipoId: a.tipoId,
                                preco: String(a.preco),
                                estoque: String(a.estoque),
                              });
                            }}
                          >
                            <Pencil className="size-4" aria-hidden="true" />
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={ocupadoId === a.id}
                            onClick={() => void alternarAtivo(a)}
                          >
                            {a.ativo ? `Desativar ${a.nome}` : `Reativar ${a.nome}`}
                          </Button>
                        </div>
                      </TableCell>
                    </>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </FormCard>
  );
}
