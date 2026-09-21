"use client";

import { useEffect, useMemo, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  adicionaisDisponiveis,
  type AdicionalDisponivel,
} from "@/lib/api-client";

export interface ItemEscolhido {
  adicionalId: string;
  quantidade: number;
}

const emReais = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

/**
 * Quantas reservas o pedido vira: horários **seguidos** são um bloco, separados
 * são blocos independentes — a mesma regra do servidor (SPEC-011). O adicional
 * vale para **cada** reserva (SPEC-054/D6), então o total do pedido multiplica
 * por aqui.
 */
export function contarBlocos(rotulos: readonly string[]): number {
  const ordenados = [...rotulos].sort();
  let blocos = 0;
  let fimAnterior: string | null = null;
  for (const rotulo of ordenados) {
    const [inicio, fim] = rotulo.split("-");
    if (inicio !== fimAnterior) blocos += 1;
    fimAnterior = fim;
  }
  return blocos;
}

/**
 * SPEC-054/D12 — **o seletor de adicionais do gestor**, nos três lugares em que
 * ele cria reserva avulsa.
 *
 * - Pede a disponibilidade para a data e os horários escolhidos, e **não deixa
 *   passar do `disponivel`** — mas a tela não reserva nada: a corrida termina em
 *   `409 ESTOQUE_ESGOTADO` no servidor, e quem usa troca a `chave` para reler
 *   (LIM-054j).
 * - **Some** quando o clube não tem adicional ativo — o mesmo que o `back`
 *   anterior à SPEC-054 responde (`404`, que o cliente já transforma em lista
 *   vazia).
 * - Informa os itens e a soma de UMA reserva; o total do pedido é de quem usa.
 */
export function SeletorDeAdicionais({
  data,
  slots,
  onChange,
  onCarregando,
  desabilitado = false,
  chave = 0,
}: {
  data: string;
  slots: readonly string[];
  onChange: (itens: ItemEscolhido[], somaPorReserva: number) => void;
  /**
   * DEF-037 — avisa quem usa enquanto a disponibilidade está sendo buscada,
   * para o botão de confirmar não aceitar clique antes de a lista existir.
   */
  onCarregando?: (carregando: boolean) => void;
  desabilitado?: boolean;
  /** Troque para reler a disponibilidade (depois de um `409`). */
  chave?: number;
}) {
  const [disponiveis, setDisponiveis] = useState<AdicionalDisponivel[]>([]);
  const [quantidades, setQuantidades] = useState<Record<string, number>>({});
  const [erro, setErro] = useState<string | null>(null);
  /**
   * DEF-037 — **para QUAL pedido o `disponiveis`/`erro` acima valem.**
   *
   * Antes, `disponiveis = []` respondia a duas perguntas diferentes — *"o clube
   * não tem adicional"* e *"ainda estou buscando"* — e as duas desenhavam a
   * mesma coisa: **nada**. Quem escolhia o horário e clicava em confirmar sem
   * esperar marcava a aula sem nunca ver a lista.
   *
   * E a janela não era canto raro: este componente só MONTA depois do horário
   * escolhido, então a busca começa exatamente no instante em que a pessoa vai
   * clicar.
   */
  const [respondido, setRespondido] = useState<string | null>(null);

  const slotsChave = [...slots].sort().join(",");
  const pedido = `${data}|${slotsChave}|${chave}`;

  /**
   * **DERIVADO, e não estado** — e isso não é estilo, é o lint do React:
   * *"Calling setState synchronously within an effect can trigger cascading
   * renders"*. A primeira versão desta correção guardava `carregando` num
   * `useState` e o ligava no corpo do efeito; o portão reprovou, com razão.
   *
   * Comparar o pedido atual com o último respondido dá a mesma resposta sem
   * escrever estado nenhum na ida.
   */
  const carregando = data !== "" && slotsChave !== "" && respondido !== pedido;

  useEffect(() => {
    if (!data || slotsChave === "") return;
    let vivo = true;
    adicionaisDisponiveis(data, slotsChave.split(","))
      .then((lista) => {
        if (!vivo) return;
        setDisponiveis(lista);
        setErro(null);
        // O que já estava escolhido e deixou de caber é recortado ao disponível.
        setQuantidades((atual) => {
          const novo: Record<string, number> = {};
          for (const a of lista) {
            const q = Math.min(atual[a.id] ?? 0, a.disponivel);
            if (q > 0) novo[a.id] = q;
          }
          return novo;
        });
      })
      .catch(() => {
        if (vivo) setErro("Não foi possível carregar os adicionais.");
      })
      // `finally` e não `await` com `try`: o compilador do React não prova que
      // um `try/finally` é assíncrono, e a suíte já reprovou esse arranjo antes.
      // `finally` e não `await` com `try`: o compilador do React não prova que
      // um `try/finally` é assíncrono, e a suíte já reprovou esse arranjo antes.
      .finally(() => {
        if (vivo) setRespondido(pedido);
      });
    return () => {
      vivo = false;
    };
  }, [data, slotsChave, chave, pedido]);

  /**
   * Avisa quem usa. **Num efeito próprio, e não no de cima**: quem chama passa
   * função nova a cada render, e ela fica fora das dependências pela mesma
   * razão que o `onChange`.
   */
  useEffect(() => {
    onCarregando?.(carregando);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [carregando]);

  const precoPorId = useMemo(
    () => new Map(disponiveis.map((a) => [a.id, a.preco])),
    [disponiveis],
  );

  useEffect(() => {
    const itens = Object.entries(quantidades)
      .filter(([, q]) => q > 0)
      .map(([adicionalId, quantidade]) => ({ adicionalId, quantidade }));
    const soma = itens.reduce(
      (total, i) => total + (precoPorId.get(i.adicionalId) ?? 0) * i.quantidade,
      0,
    );
    onChange(itens, Math.round(soma * 100) / 100);
    // `onChange` fora das dependências de propósito: quem usa passa função nova a
    // cada render, e reenviar a mesma escolha a cada render seria laço.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quantidades, precoPorId]);

  // DEF-037 — **carregando tem cara própria.** Sem isto, esperar e "o clube
  // não tem adicional" eram a mesma tela vazia.
  if (carregando) {
    return (
      <p
        role="status"
        className="text-xs text-[var(--color-on-surface-variant)]"
      >
        Carregando adicionais…
      </p>
    );
  }
  if (erro) {
    return (
      <p role="alert" className="text-xs text-[var(--color-error)]">
        {erro}
      </p>
    );
  }
  if (disponiveis.length === 0) return null;

  const mudar = (id: string, delta: number, maximo: number) =>
    setQuantidades((atual) => {
      const q = Math.max(0, Math.min(maximo, (atual[id] ?? 0) + delta));
      return { ...atual, [id]: q };
    });

  return (
    <fieldset className="flex flex-col gap-2" disabled={desabilitado}>
      <legend className="text-sm font-medium">Adicionais</legend>
      <ul className="flex flex-col gap-2">
        {disponiveis.map((a) => {
          const q = quantidades[a.id] ?? 0;
          return (
            <li
              key={a.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2"
            >
              <div className="flex min-w-0 flex-col">
                <span className="truncate text-sm font-semibold">{a.nome}</span>
                <span className="text-xs text-[var(--color-on-surface-variant)]">
                  {emReais(a.preco)} ·{" "}
                  {a.disponivel === 0
                    ? "esgotado neste horário"
                    : `${a.disponivel} disponível(is)`}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  aria-label={`Menos ${a.nome}`}
                  disabled={q === 0}
                  onClick={() => mudar(a.id, -1, a.disponivel)}
                >
                  <Minus className="size-4" aria-hidden="true" />
                </Button>
                <span className="w-6 text-center text-sm font-semibold" aria-live="polite">
                  {q}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  aria-label={`Mais ${a.nome}`}
                  disabled={q >= a.disponivel}
                  onClick={() => mudar(a.id, 1, a.disponivel)}
                >
                  <Plus className="size-4" aria-hidden="true" />
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
    </fieldset>
  );
}
