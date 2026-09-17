import { describe, expect, it } from "vitest";
import {
  BORDA_DO_ESTADO,
  NOMES_DAS_CORES,
  PALETA_DE_QUADRA,
  estadoDoItem,
  lotacaoDaAula,
  rotuloDaQuadra,
} from "./visual-da-agenda";

/**
 * SPEC-057/TASK-005/D19 — a regra que a grade e a legenda compartilham.
 */
describe("visual da agenda (D19)", () => {
  it("a paleta tem as seis cores do contrato, cada uma com nome", () => {
    expect(PALETA_DE_QUADRA).toEqual([
      "#00763A",
      "#31658C",
      "#A23B1E",
      "#6B46A3",
      "#8B5E00",
      "#A12B65",
    ]);
    expect(new Set(Object.values(NOMES_DAS_CORES)).size).toBe(6);
  });

  it("homônimas se distinguem pelo código, e só por ele", () => {
    expect(rotuloDaQuadra("Quadra 1", "3")).toBe("Quadra 1 · Q-3");
    expect(rotuloDaQuadra("Quadra 1", "3")).not.toBe(
      rotuloDaQuadra("Quadra 1", "4"),
    );
  });

  it.each([
    ["TURMA", "pendente_pagamento", "programada"],
    ["TURMA", "cancelado", "cancelada"],
    ["AVULSO", "pago", "pago"],
    ["AVULSO", "pendente_pagamento", "pendente"],
    ["PARTICULAR", "pago", "pago"],
    ["PARTICULAR", "cancelado", "cancelada"],
  ] as const)("%s + %s → %s", (tipoVisual, statusPagamento, esperado) => {
    expect(estadoDoItem({ tipoVisual, statusPagamento })).toBe(esperado);
  });

  it("turma nunca é 'Pendente': o status de pagamento dela não significa cobrança", () => {
    expect(
      estadoDoItem({ tipoVisual: "TURMA", statusPagamento: "pendente_pagamento" }),
    ).not.toBe("pendente");
  });

  it("só o pendente é tracejado; o estado é FORMA, não cor", () => {
    expect(BORDA_DO_ESTADO).toEqual({
      cancelada: "continua",
      programada: "continua",
      pago: "continua",
      pendente: "tracejada",
    });
  });

  it("lotação: vagas, cheia e excedente visível; nula fora de turma", () => {
    expect(
      lotacaoDaAula({ ocupados: 5, capacidade: 8, vagasNaOcorrencia: 3 }),
    ).toBe("3 vagas · 5/8");
    expect(
      lotacaoDaAula({ ocupados: 7, capacidade: 8, vagasNaOcorrencia: 1 }),
    ).toBe("1 vaga · 7/8");
    expect(
      lotacaoDaAula({ ocupados: 9, capacidade: 8, vagasNaOcorrencia: 0 }),
    ).toBe("Cheia · 9/8");
    expect(
      lotacaoDaAula({ ocupados: null, capacidade: null, vagasNaOcorrencia: null }),
    ).toBeNull();
  });
});
