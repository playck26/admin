import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, type ItemDoDia } from "@/lib/api-client";
import { AgendaSemanaAcoes } from "./agenda-semana-acoes";

/**
 * SPEC-054/D12 — **o seletor de adicionais na "Nova reserva" da agenda da
 * semana**, um dos três lugares em que o gestor cria reserva avulsa.
 *
 * Mover e cancelar aula não levam seletor: mover não muda o valor nem os itens
 * (D4), e aula de turma não tem adicional.
 */

const listarAlunos = vi.hoisted(() => vi.fn());
const criarReserva = vi.hoisted(() => vi.fn());
const disponiveis = vi.hoisted(() => vi.fn());
const mover = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api-client", async () => {
  const real =
    await vi.importActual<typeof import("@/lib/api-client")>("@/lib/api-client");
  return {
    ...real,
    listStudents: listarAlunos,
    createBooking: criarReserva,
    adicionaisDisponiveis: disponiveis,
    moveBooking: mover,
  };
});

const RAQUETE = {
  id: "ad-1",
  tipoId: "t-1",
  tipoNome: "Raquetes",
  nome: "Raquete",
  preco: 15,
  disponivel: 2,
};

const CRIAR = { tipo: "criar" as const, data: "2035-06-07", hora: 9, quadraId: "q-1" };

beforeEach(() => {
  vi.clearAllMocks();
  listarAlunos.mockResolvedValue({ data: [{ id: "a-1", nome: "Ana" }], total: 1 });
  criarReserva.mockResolvedValue({ reservas: [] });
  disponiveis.mockResolvedValue([RAQUETE]);
  mover.mockResolvedValue({});
});

async function abrirCriar() {
  render(<AgendaSemanaAcoes acao={CRIAR} onFechar={vi.fn()} onMudou={vi.fn()} />);
  await screen.findByRole("option", { name: "Ana" });
  fireEvent.change(screen.getByLabelText("Aluno"), { target: { value: "a-1" } });
}

describe("AgendaSemanaAcoes — SPEC-054/D12", () => {
  it("pede a disponibilidade do horário da célula e manda os itens escolhidos", async () => {
    await abrirCriar();
    await waitFor(() =>
      expect(disponiveis).toHaveBeenCalledWith("2035-06-07", ["09:00-10:00"]),
    );
    fireEvent.click(await screen.findByRole("button", { name: "Mais Raquete" }));
    fireEvent.click(screen.getByRole("button", { name: "Mais Raquete" }));
    // A tela não sabe o preço da quadra: diz o que os adicionais acrescentam.
    expect(await screen.findByText(/Adicionais: \+\s*R\$\s*30,00/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(criarReserva).toHaveBeenCalled());
    const [dto] = criarReserva.mock.calls[0] as [{ adicionais?: unknown }];
    expect(dto.adicionais).toEqual([{ adicionalId: "ad-1", quantidade: 2 }]);
  });

  it("sem escolha, o pedido não leva o campo", async () => {
    await abrirCriar();
    await screen.findByRole("button", { name: "Mais Raquete" });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(criarReserva).toHaveBeenCalled());
    const [dto] = criarReserva.mock.calls[0] as [Record<string, unknown>];
    expect("adicionais" in dto).toBe(false);
  });

  it("LIM-054j: `409 ESTOQUE_ESGOTADO` mostra a mensagem e relê a disponibilidade", async () => {
    criarReserva.mockRejectedValue(
      new ApiError(409, "Raquete esgotou neste horário.", undefined, "ESTOQUE_ESGOTADO"),
    );
    await abrirCriar();
    fireEvent.click(await screen.findByRole("button", { name: "Mais Raquete" }));
    const antes = disponiveis.mock.calls.length;
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    expect(await screen.findByText("Raquete esgotou neste horário.")).toBeInTheDocument();
    await waitFor(() => expect(disponiveis.mock.calls.length).toBeGreaterThan(antes));
  });

  it("mover não oferece adicional — mover não muda valor nem itens (D4)", async () => {
    const item = {
      id: "r-1",
      quadraId: "q-1",
      quadraNome: "Quadra 1",
      horaInicio: "09:00",
      horaFim: "10:00",
      origemTipo: "AVULSO",
      origemTurmaId: null,
      responsavel: "Ana",
      statusPagamento: "pago",
      valor: 100,
      criadaPor: null,
      canceladaPor: null,
      adicionais: [],
    } as unknown as ItemDoDia;
    render(
      <AgendaSemanaAcoes
        acao={{ tipo: "mover", item, data: "2035-06-07" }}
        onFechar={vi.fn()}
        onMudou={vi.fn()}
      />,
    );
    await screen.findByText(/Mover não muda o aluno/);
    expect(disponiveis).not.toHaveBeenCalled();
  });
});
