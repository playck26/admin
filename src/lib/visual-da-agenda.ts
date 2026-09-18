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

/**
 * SPEC-060/D3 — **as cores dos TIPOS, que vivem só na grade do mês.**
 *
 * O Israel foi explícito ao separar as duas leituras: *"as cores da quadra não
 * mostram no calendário, só na informação do dia; o que mostra no calendário
 * são as cores para os tipos de reserva."*
 *
 * São três das seis cores da paleta de quadra, e isso é **deliberado**: elas
 * já têm contraste medido neste produto (5,75:1, 5,39:1 e 5,14:1 sobre o
 * cartão claro) e **nunca dividem tela** com as cores de quadra — no mês só há
 * tipo; no dia e na semana só há quadra. Não existe onde confundir "verde =
 * turma" com "verde = Quadra 1".
 *
 * **A cor nunca responde sozinha** (a regra da SPEC-052/D3): o rótulo do dia
 * diz por extenso quantos de cada tipo, e a legenda nomeia as três.
 */
export const COR_DO_TIPO: Record<TipoVisual, string> = {
  TURMA: "#00763A",
  PARTICULAR: "#31658C",
  AVULSO: "#8B5E00",
};

/** A ordem em que os pontos e a legenda aparecem. Estável, para não dançar. */
export const TIPOS_NA_ORDEM: TipoVisual[] = ["TURMA", "PARTICULAR", "AVULSO"];

/** O plural que o rótulo do dia usa, por tipo. */
const PLURAL_DO_TIPO: Record<TipoVisual, [string, string]> = {
  TURMA: ["aula de turma", "aulas de turma"],
  PARTICULAR: ["aula particular", "aulas particulares"],
  // **"reserva", e não "reserva de quadra":** a SPEC-053/AC-001 tirou essa
  // expressão do painel, e o gate de redação a pegou aqui. O vocabulário do
  // Admin já é "Reserva" (`ROTULO_DO_TIPO`), então o rótulo falado passa a
  // dizer o mesmo que a legenda mostra.
  AVULSO: ["reserva", "reservas"],
};

export type ContagemPorTipo = Partial<Record<TipoVisual, number>>;

/**
 * SPEC-060/AC-002 — o que o leitor de tela ouve no dia do mês.
 *
 * Contagens ausentes (Back antigo, durante o rollout) caem no comportamento
 * de hoje: só o total. **Ler `undefined` como zero apagaria o dia inteiro** —
 * por isso a ausência é tratada antes, e não com `?? 0`.
 */
export function rotuloDoDiaDoMes(
  numero: number,
  total: number,
  porTipo: ContagemPorTipo,
  fechado: boolean,
): string {
  const fim = fechado ? ", fechado" : "";
  if (total === 0) return `${numero}${fechado ? ", fechado" : ", sem reserva"}`;

  const partes = TIPOS_NA_ORDEM.flatMap((tipo) => {
    const n = porTipo[tipo];
    if (n === undefined || n === 0) return [];
    const [um, muitos] = PLURAL_DO_TIPO[tipo];
    return [`${n} ${n === 1 ? um : muitos}`];
  });

  if (partes.length === 0) {
    return `${numero}: ${total} ${total === 1 ? "reserva" : "reservas"}${fim}`;
  }
  return `${numero}: ${partes.join(", ")}${fim}`;
}
