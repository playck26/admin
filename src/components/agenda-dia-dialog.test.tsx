import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AgendaDiaDialog } from "./agenda-dia-dialog";

/** SPEC-054/D12 — os itens da reserva aparecem no diálogo do dia da agenda. */

const agendaDoDia = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api-client", async () => {
  const real =
    await vi.importActual<typeof import("@/lib/api-client")>("@/lib/api-client");
  return { ...real, getAgendaDia: agendaDoDia };
});

function item(id: string, responsavel: string, adicionais: unknown[]) {
  return {
    id,
    quadraId: "q-1",
    quadraNome: "Quadra 1",
    horaInicio: "09:00",
    horaFim: "10:00",
    origemTipo: "AVULSO",
    origemTurmaId: null,
    responsavel,
    statusPagamento: "pago",
    valor: 130,
    criadaPor: null,
    canceladaPor: null,
    adicionais,
    // SPEC-057/TASK-005 — o contrato do item cresceu: cor e código da quadra,
    // tipo visual e a ocupação da aula (nula fora de turma).
    quadraCor: "#00763A",
    quadraCodigoAgenda: "1",
    tipoVisual: "AVULSO",
    capacidade: null,
    matriculados: null,
    faltasAvisadas: null,
    reposicoesMarcadas: null,
    reposicoesNaOcupacao: null,
    ocupados: null,
    vagasNaOcorrencia: null,
  };
}

beforeEach(() => {
  agendaDoDia.mockReset();
});

describe("AgendaDiaDialog — SPEC-054/D12", () => {
  it("a reserva com adicional lista os itens; a sem adicional não mostra nada a mais", async () => {
    agendaDoDia.mockResolvedValue([
      item("r-1", "Ana", [
        { adicionalId: "ad-1", nome: "Raquete", quantidade: 2, valorUnitario: 15 },
        { adicionalId: "ad-2", nome: "Bola", quantidade: 1, valorUnitario: 5 },
      ]),
      item("r-2", "Bruno", []),
    ]);
    render(<AgendaDiaDialog data="2035-06-07" onFechar={vi.fn()} onMudou={vi.fn()} />);

    expect(await screen.findByText("2× Raquete, 1× Bola")).toBeInTheDocument();
    expect(screen.getAllByText(/×/)).toHaveLength(1);
  });
});
