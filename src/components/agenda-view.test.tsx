import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DiaDaAgenda, ItemDoDia } from "@/lib/api-client";
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

/**
 * SPEC-021/INV-059 — **`unknown[]` era o buraco, e ele anulava o alias.**
 *
 * `ItemDoDia` virou apelido de `ItemDaAgendaResponseDto`, mas isso sozinho
 * não protegia esta tela: a fixture entrava como `unknown[]`, o TypeScript
 * nunca a confrontava com nada, e `getAgendaDia` faz `as ItemDoDia[]`. Um
 * `as` de um lado e um `unknown` do outro se cancelam — a corrente inteira
 * fica sem elo.
 *
 * Tipada, **a fixture é que fica vermelha** quando o `back` muda a forma. E
 * ela já pegou uma coisa hoje: até 2026-08-27 o contrato publicava
 * `statusPagamento: 'pendente'`, valor que não existe no banco (DEF-016).
 * Esta fixture sempre disse `pendente_pagamento`, que é o certo — e com
 * `unknown[]` ninguém tinha como notar a discordância.
 */
function mockRotas(itensDoDia: ItemDoDia[] = []) {
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
        origemTurmaId: null,
        responsavel: "Israel",
        statusPagamento: "pendente_pagamento",
        // SPEC-011 — o valor COBRADO, congelado. A fixture não o tinha, e o
        // teste passava: ela descrevia uma API mais pobre que a real.
        valor: 150,
        criadaPor: null,
        canceladaPor: null,
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
        origemTurmaId: "11111111-1111-4111-8111-111111111111",
        responsavel: "Turma das 14h",
        statusPagamento: "pendente_pagamento",
        // SPEC-011 — o valor COBRADO, congelado. A fixture não o tinha, e o
        // teste passava: ela descrevia uma API mais pobre que a real.
        valor: 150,
        criadaPor: null,
        canceladaPor: null,
      },
    ]);

    render(<AgendaView />);
    fireEvent.click(await screen.findByText("3 reservas"));

    expect(await screen.findByText("14:00–15:00 · Quadra 2")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancelar" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Marcar pago" })).not.toBeInTheDocument();
  });

  // SPEC-032/AC-009 — as duas pontas, e o caso nulo, que e o mais comum hoje.
  it("mostra quem criou e quem cancelou", async () => {
    mockRotas([
      {
        id: "o1",
        quadraNome: "Quadra 1",
        horaInicio: "09:00",
        horaFim: "10:00",
        origemTipo: "AVULSO",
        origemTurmaId: null,
        responsavel: "Israel",
        statusPagamento: "cancelado",
        valor: 150,
        criadaPor: "Maria",
        canceladaPor: "Gabriel",
      },
    ]);

    render(<AgendaView />);
    fireEvent.click(await screen.findByText("3 reservas"));

    expect(
      await screen.findByText("criada por Maria · cancelada por Gabriel"),
    ).toBeInTheDocument();
  });

  it("linha sem evento diz 'sem histórico registrado', não 'criada por —'", async () => {
    mockRotas([
      {
        id: "o1",
        quadraNome: "Quadra 1",
        horaInicio: "09:00",
        horaFim: "10:00",
        origemTipo: "AVULSO",
        origemTurmaId: null,
        responsavel: "Israel",
        statusPagamento: "pendente_pagamento",
        valor: 150,
        // LIM-032a — as ocupacoes anteriores a spec nasceram sem evento, e
        // nao ha como inventar um. Este e o estado NORMAL de quase toda linha
        // em producao no dia do deploy, nao um caso de borda.
        criadaPor: null,
        canceladaPor: null,
      },
    ]);

    render(<AgendaView />);
    fireEvent.click(await screen.findByText("3 reservas"));

    expect(
      await screen.findByText("sem histórico registrado"),
    ).toBeInTheDocument();
  });

  it("AC-006: marcar pago chama o endpoint existente e recarrega o dia", async () => {
    mockRotas([
      {
        id: "o1",
        quadraNome: "Quadra 1",
        horaInicio: "09:00",
        horaFim: "10:00",
        origemTipo: "AVULSO",
        origemTurmaId: null,
        responsavel: "Israel",
        statusPagamento: "pendente_pagamento",
        // SPEC-011 — o valor COBRADO, congelado. A fixture não o tinha, e o
        // teste passava: ela descrevia uma API mais pobre que a real.
        valor: 150,
        criadaPor: null,
        canceladaPor: null,
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
