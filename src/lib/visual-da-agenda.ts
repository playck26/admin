import type { components } from "@/lib/api-types";

/**
 * SPEC-057/TASK-005/D19 — **como a agenda do gestor desenha cada item, sem
 * depender de cor.**
 *
 * Antes desta task a grade pintava o fundo do bloco por tipo e status
 * (turma, pago, pendente) com três tokens que medem **1,04:1 entre si**
 * (SPEC-052/D3) — distinção que só existia para quem enxerga bem a diferença.
 * A cor passa a significar **quadra**, e mesmo ela é auxiliar (INV-140): quem
 * identifica é o texto.
 *
 * Tudo que a grade e a legenda precisam saber sobre forma, rótulo e borda sai
 * daqui, num lugar só — a legenda que explicasse uma regra diferente da que o
 * bloco aplica seria a mesma mentira que a SPEC-052 já pagou.
 */

export type CorDeQuadra = components["schemas"]["QuadraResponseDto"]["cor"];

type ItemDaAgenda = components["schemas"]["ItemDaAgendaResponseDto"];

/**
 * A paleta, com o nome que o gestor lê. O `satisfies` amarra a lista ao enum
 * do contrato: uma cor a mais ou a menos no Back quebra o typecheck aqui, e
 * não uma amostra sem nome na tela.
 */
export const NOMES_DAS_CORES = {
  "#00763A": "Verde",
  "#31658C": "Azul",
  "#A23B1E": "Telha",
  "#6B46A3": "Roxo",
  "#8B5E00": "Mostarda",
  "#A12B65": "Vinho",
} as const satisfies Record<CorDeQuadra, string>;

export const PALETA_DE_QUADRA = Object.keys(NOMES_DAS_CORES) as CorDeQuadra[];

/** O substrato do bloco: branco opaco em todos os estados (D19). */
export const SUBSTRATO_DO_BLOCO = "#FFFFFF";
/** O texto do bloco: contraste alto contra o substrato, fixo em todos os temas. */
export const TEXTO_DO_BLOCO = "#12160F";

/**
 * **Nome + código, sempre.** Duas quadras podem se chamar igual e ter a mesma
 * cor; o `Q-<código>` é o que as separa, e ele nunca é cortado.
 */
export function rotuloDaQuadra(nome: string, codigoAgenda: string): string {
  return `${nome} · Q-${codigoAgenda}`;
}

export type TipoVisual = ItemDaAgenda["tipoVisual"];

export const ROTULO_DO_TIPO: Record<TipoVisual, string> = {
  TURMA: "Turma",
  AVULSO: "Reserva",
  PARTICULAR: "Particular",
};

export type EstadoVisual = "cancelada" | "programada" | "pago" | "pendente";

export const ROTULO_DO_ESTADO: Record<EstadoVisual, string> = {
  cancelada: "Cancelada",
  programada: "Programada",
  pago: "Pago",
  pendente: "Pendente",
};

/** A borda que carrega o estado — forma, e não cor. */
export const BORDA_DO_ESTADO: Record<EstadoVisual, "continua" | "tracejada"> = {
  cancelada: "continua",
  programada: "continua",
  pago: "continua",
  pendente: "tracejada",
};

/**
 * O estado que o bloco mostra.
 *
 * **Cancelada tem precedência** sobre qualquer outro: uma reserva paga que foi
 * cancelada é, para quem opera a agenda, cancelada. Turma ativa é
 * *Programada* — `statusPagamento` numa aula de turma não significa pagamento
 * (a ocupação de turma nasce `pendente_pagamento` e nunca é cobrada), e
 * escrever "Pendente" numa aula faria o gestor procurar quem deve.
 */
export function estadoDoItem(
  item: Pick<ItemDaAgenda, "tipoVisual" | "statusPagamento">,
): EstadoVisual {
  if (item.statusPagamento === "cancelado") return "cancelada";
  if (item.tipoVisual === "TURMA") return "programada";
  return item.statusPagamento === "pago" ? "pago" : "pendente";
}

/**
 * A lotação da aula de turma, em texto. Nulo para reserva e particular.
 *
 * Usa a ocupação DESTA aula (`ocupados`), e não as matrículas: é ela que diz
 * se ainda cabe alguém hoje (D17). "Cheia" não esconde o excedente.
 */
export function lotacaoDaAula(
  item: Pick<ItemDaAgenda, "ocupados" | "capacidade" | "vagasNaOcorrencia">,
): string | null {
  if (item.ocupados === null || item.capacidade === null) return null;
  const fracao = `${item.ocupados}/${item.capacidade}`;
  if (item.vagasNaOcorrencia === 0) return `Cheia · ${fracao}`;
  const vagas = item.vagasNaOcorrencia ?? 0;
  return `${vagas} ${vagas === 1 ? "vaga" : "vagas"} · ${fracao}`;
}
