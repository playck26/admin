import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AgendaView } from "./agenda-view";

// TEST-012 (SPEC-012): o calendário mostra volume e o pop-up mostra e age.
// O mock responde por rota — a tela faz duas chamadas diferentes (mês e
// dia), e um mock cego devolveria a mesma coisa nas duas.

function dia(data: string, over: Record<string, unknown> = {}) {
  return { data, total: 0, pendentes: 0, fechado: false, ...over };
}

const MES = [
  dia("2026-08-01"),
  dia("2026-08-02", { fechado: true }),
  dia("2026-08-03", { total: 3, pendentes: 2 }),
];

function mockRotas(itensDoDia: unknown[] = []) {
  (fetch as unknown as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
    const u = String(url);
    const corpo = /\/agenda\/\d{4}-\d{2}-\d{2}/.test(u) ? itensDoDia : MES;
    return Promise.resolve({ ok: true, json: async () => corpo });
  });
}

describe("AgendaView (SPEC-012)", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  it("mostra volume e pendências no dia, e marca dia fechado", async () => {
    mockRotas();

    render(<AgendaView />);

    expect(await screen.findByText("3 reservas")).toBeInTheDocument();
    expect(screen.getByText("2 a receber")).toBeInTheDocument();
    // SPEC-010: fechado é informação, não ausência dela.
    expect(screen.getByText("fechado")).toBeInTheDocument();
  });

  it("AC-003: clicar no dia abre o detalhe com quadra, horário e responsável", async () => {
    mockRotas([
      {
        id: "o1",
        quadraNome: "Quadra 1",
        horaInicio: "09:00",
        horaFim: "11:00",
        origemTipo: "AVULSO",
        responsavel: "Israel",
        statusPagamento: "pendente_pagamento",
      },
    ]);

    render(<AgendaView />);
    fireEvent.click(await screen.findByText("3 reservas"));

    expect(await screen.findByText("09:00–11:00 · Quadra 1")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Marcar pago" })).toBeInTheDocument();
  });

  // AC-007: cancelar ocorrência de turma apagaria a aula de todos os
  // matriculados, e "marcar pago" numa aula é estado sem significado. O
  // servidor recusa as duas — a tela nem oferece.
  it("AC-007: linha de turma não mostra nenhuma ação", async () => {
    mockRotas([
      {
        id: "o2",
        quadraNome: "Quadra 2",
        horaInicio: "14:00",
        horaFim: "15:00",
        origemTipo: "TURMA",
        responsavel: "Turma das 14h",
        statusPagamento: "pendente_pagamento",
      },
    ]);

    render(<AgendaView />);
    fireEvent.click(await screen.findByText("3 reservas"));

    expect(await screen.findByText("14:00–15:00 · Quadra 2")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancelar" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Marcar pago" })).not.toBeInTheDocument();
  });

  it("AC-006: marcar pago chama o endpoint existente e recarrega o dia", async () => {
    mockRotas([
      {
        id: "o1",
        quadraNome: "Quadra 1",
        horaInicio: "09:00",
        horaFim: "10:00",
        origemTipo: "AVULSO",
        responsavel: "Israel",
        statusPagamento: "pendente_pagamento",
      },
    ]);

    render(<AgendaView />);
    fireEvent.click(await screen.findByText("3 reservas"));
    fireEvent.click(await screen.findByRole("button", { name: "Marcar pago" }));

    await waitFor(() => {
      const chamadas = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls;
      expect(
        chamadas.some(([url]) => String(url).includes("/bookings/o1/payment-status")),
      ).toBe(true);
    });
  });
});
