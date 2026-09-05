import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AgendaSemana } from "./agenda-semana";

/**
 * SPEC-034 — a rede de regressão da grade da semana.
 *
 * Os três casos aqui nasceram de defeitos **reais**, dois deles achados pela
 * revisão do próprio diff e o terceiro reproduzido pela validação cruzada de
 * 2026-09-05. Nenhum é hipotético, e nenhum aparece em teste de rota: os três
 * são de estado do componente, e só um teste de componente os pega.
 *
 * O molde do harness veio do script da validação cruzada
 * (`review-noite-admin.tsx.txt`, na pasta da spec 034) — com uma diferença
 * deliberada: **a fixture aqui carrega `quadraId`.** A do validador não
 * carregava, então o terceiro teste passava porque o campo era `undefined`, e
 * não porque o filtro estava certo. Um teste que passa pelo motivo errado é o
 * defeito que este arquivo existe para não ter.
 */

const api = vi.hoisted(() => ({
  getAgendaSemana: vi.fn(),
  listCourts: vi.fn(),
  listStudents: vi.fn(),
  moveBooking: vi.fn(),
  createBooking: vi.fn(),
  cancelarOcorrenciaDeTurma: vi.fn(),
}));
vi.mock("@/lib/api-client", () => ({
  ...api,
  ApiError: class extends Error {},
}));

/** Duas quadras **homônimas** — é o ponto do terceiro teste. */
const Q1 = "11111111-1111-4111-8111-111111111111";
const Q2 = "22222222-2222-4222-8222-222222222222";

function item(
  id: string,
  hora: string,
  responsavel: string,
  quadraId: string = Q1,
) {
  return {
    id,
    quadraId,
    quadraNome: "Mesmo nome",
    horaInicio: hora,
    horaFim: `${String(Number(hora.slice(0, 2)) + 1).padStart(2, "0")}:00`,
    origemTipo: "AVULSO" as const,
    origemTurmaId: null,
    responsavel,
    statusPagamento: "pendente_pagamento" as const,
    valor: 100,
    criadaPor: null,
    canceladaPor: null,
  };
}

function semana(inicio: string, itens: ReturnType<typeof item>[] = []) {
  return Array.from({ length: 7 }, (_, n) => {
    const d = new Date(`${inicio}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + n);
    return {
      data: d.toISOString().slice(0, 10),
      fechado: false,
      itens: n === 0 ? itens : [],
    };
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  api.listCourts.mockResolvedValue({
    data: [
      { id: Q1, nome: "Mesmo nome", status: "ativa" },
      { id: Q2, nome: "Mesmo nome", status: "ativa" },
    ],
  });
  api.listStudents.mockResolvedValue({ data: [] });
});
afterEach(cleanup);

describe("AgendaSemana (SPEC-034)", () => {
  /**
   * O diálogo é renderizado sem desmontar entre uma reserva e outra, e os
   * campos são estado derivado de `acao` — inicializador de `useState` só roda
   * na montagem. Sem `key`, trocar de reserva mantinha o formulário da
   * anterior e **movia a reserva errada, para o horário errado**.
   */
  it("troca de reserva reinicializa o formulario (nao move a errada)", async () => {
    api.getAgendaSemana.mockResolvedValue(
      semana("2026-09-06", [
        item("a", "09:00", "Pessoa A"),
        item("b", "14:00", "Pessoa B"),
      ]),
    );
    render(<AgendaSemana />);

    fireEvent.click(await screen.findByText("Pessoa A"));
    expect(screen.getByLabelText("Início")).toHaveValue("09:00");

    fireEvent.click(screen.getByText("Pessoa B"));
    expect(screen.getByLabelText("Início")).toHaveValue("14:00");

    fireEvent.change(screen.getByLabelText("Início"), {
      target: { value: "13:00" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() =>
      expect(api.moveBooking).toHaveBeenCalledWith("b", {
        horaInicio: "13:00",
      }),
    );
  });

  /**
   * Duas requisições no ar e nada garante a ordem de volta. Sem selo de
   * pedido, a resposta ATRASADA sobrescrevia a atual — a grade mostrava a
   * semana errada sob o cabeçalho da certa, sem erro e sem spinner.
   */
  it("resposta atrasada nao sobrescreve a semana mais recente", async () => {
    const pendentes: Array<(v: unknown) => void> = [];
    api.getAgendaSemana.mockImplementation(
      () => new Promise((r) => pendentes.push(r)),
    );
    render(<AgendaSemana />);
    await waitFor(() => expect(pendentes).toHaveLength(1));

    fireEvent.click(screen.getByRole("button", { name: "Próxima semana" }));
    await waitFor(() => expect(pendentes).toHaveLength(2));

    await act(async () =>
      pendentes[1](semana("2026-09-13", [item("b", "14:00", "Nova")])),
    );
    expect(screen.getByText("Nova")).toBeInTheDocument();

    await act(async () =>
      pendentes[0](semana("2026-09-06", [item("a", "09:00", "Velha")])),
    );
    expect(screen.queryByText("Velha")).not.toBeInTheDocument();
    expect(screen.getByText("Nova")).toBeInTheDocument();
  });

  /**
   * **`quadras.nome` não é único no banco** — não tem `@unique` no schema. O
   * filtro casava por nome, então escolher a quadra A mostrava a reserva da B
   * homônima. Reproduzido pela validação cruzada de 2026-09-05.
   *
   * As DUAS direções são afirmadas de propósito: um filtro que esconde tudo
   * também passaria na metade negativa.
   */
  it("filtra por quadraId, e nao pelo nome homonimo", async () => {
    api.getAgendaSemana.mockResolvedValue(
      semana("2026-09-06", [item("b", "14:00", "Reserva da q2", Q2)]),
    );
    render(<AgendaSemana />);
    await screen.findByText("Reserva da q2");

    // A quadra ERRADA esconde...
    fireEvent.change(screen.getByLabelText("Quadra"), {
      target: { value: Q1 },
    });
    expect(screen.queryByText("Reserva da q2")).not.toBeInTheDocument();

    // ...e a CERTA mostra. Sem esta metade, um filtro que esconde tudo
    // passaria.
    fireEvent.change(screen.getByLabelText("Quadra"), {
      target: { value: Q2 },
    });
    expect(screen.getByText("Reserva da q2")).toBeInTheDocument();
  });
});
