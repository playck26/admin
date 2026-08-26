"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Trash2 } from "lucide-react";
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
  criarOpcaoDeCatalogo,
  listarCatalogo,
  removerOpcaoDeCatalogo,
  type CatalogoDeQuadra,
  type OpcaoDeQuadra,
} from "@/lib/api-client";

/**
 * SPEC-020/TASK-005 — a tela de um catálogo de quadra.
 *
 * **Um componente para os dois**, no molde de `levels-manager`. Esporte e
 * categoria têm a mesma forma e a mesma regra — e o servidor já os trata com
 * a mesma base. Duas telas iguais seriam duas chances de divergirem, e a
 * divergência apareceria como "no esporte dá pra apagar em uso e na categoria
 * não".
 *
 * ## O 422 aqui é informação, não falha
 *
 * O servidor recusa apagar opção em uso e devolve **quantas** quadras a usam.
 * Mostrar "está em uso por 3 quadras" é acionável: a pessoa sabe que precisa
 * trocar o esporte daquelas três antes. "Não foi possível remover" a deixaria
 * clicando de novo.
 */
export function CatalogoDeQuadraManager({
  catalogo,
  titulo,
  descricao,
  exemplo,
}: {
  catalogo: CatalogoDeQuadra;
  titulo: string;
  descricao: string;
  exemplo: string;
}) {
  const [opcoes, setOpcoes] = useState<OpcaoDeQuadra[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [nome, setNome] = useState("");
  const [criando, setCriando] = useState(false);
  const [erroCriar, setErroCriar] = useState<string | null>(null);
  const [removendoId, setRemovendoId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setOpcoes(await listarCatalogo(catalogo));
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Não foi possível carregar as opções.",
      );
    } finally {
      setLoading(false);
    }
  }, [catalogo]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function handleCriar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErroCriar(null);
    setCriando(true);
    try {
      // A `ordem` vai como o tamanho da lista: a opção nova entra no fim, que
      // é o que a pessoa espera de um formulário de acrescentar. Reordenar é
      // outra demanda, e sem ela um campo "ordem" na tela seria um número
      // para a pessoa adivinhar.
      await criarOpcaoDeCatalogo(catalogo, { nome, ordem: opcoes.length });
      setNome("");
      await load();
    } catch (err) {
      setErroCriar(
        err instanceof ApiError
          ? err.message
          : "Não foi possível criar a opção.",
      );
    } finally {
      setCriando(false);
    }
  }

  async function handleRemover(id: string) {
    setRemovendoId(id);
    setError(null);
    try {
      await removerOpcaoDeCatalogo(catalogo, id);
      await load();
    } catch (err) {
      // A mensagem do servidor já diz quantas quadras usam a opção.
      setError(
        err instanceof ApiError
          ? err.message
          : "Não foi possível remover a opção.",
      );
    } finally {
      setRemovendoId(null);
    }
  }

  return (
    <FormCard title={titulo} description={descricao}>
      <form onSubmit={handleCriar} className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex flex-1 flex-col gap-2">
          <Label htmlFor={`nome-${catalogo}`}>Nome</Label>
          <Input
            id={`nome-${catalogo}`}
            required
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder={exemplo}
            disabled={criando}
            className="h-11 px-4"
          />
        </div>
        <Button type="submit" disabled={criando || nome.trim() === ""} className="h-11">
          {criando ? "Adicionando..." : "Adicionar"}
        </Button>
      </form>

      {erroCriar ? (
        <p role="alert" className="mt-3 text-sm font-semibold text-[var(--color-error)]">
          {erroCriar}
        </p>
      ) : null}

      <div className="mt-6">
        {loading ? (
          <p className="text-sm text-[var(--color-on-surface-variant)]">Carregando...</p>
        ) : opcoes.length === 0 ? (
          /*
            Estado vazio que diz o que fazer. Sem isso, o gestor vê uma tabela
            em branco e não sabe se é erro de carregamento ou se ele nunca
            cadastrou nada.
          */
          <p className="text-sm text-[var(--color-on-surface-variant)]">
            Nenhuma opção ainda. Cadastre a primeira acima — ela vai aparecer
            no cadastro de quadra e virar filtro no app do aluno.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead className="w-24 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {opcoes.map((opcao) => (
                <TableRow key={opcao.id}>
                  <TableCell className="font-semibold">{opcao.nome}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={removendoId === opcao.id}
                      onClick={() => void handleRemover(opcao.id)}
                      aria-label={`Remover ${opcao.nome}`}
                    >
                      <Trash2 className="size-4" aria-hidden="true" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {error ? (
        <p role="alert" className="mt-4 text-sm font-semibold text-[var(--color-error)]">
          {error}
        </p>
      ) : null}
    </FormCard>
  );
}
