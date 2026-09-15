import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Adicional } from "@/lib/api-client";
import { AdicionaisManager } from "./adicionais-manager";

/**
 * SPEC-054/D12 e D13 — **a tela dos adicionais** (`/reservas/adicionais`):
 * criar, editar preço, estoque, tipo e ativo; e, depois de salvar, os horários
 * que ficaram acima do estoque.
 */

const listarAdicionais = vi.hoisted(() => vi.fn());
const listarTiposDeAdicional = vi.hoisted(() => vi.fn());
const criarAdicional = vi.hoisted(() => vi.fn());
const editarAdicional = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api-client", async () => {
  const real =
    await vi.importActual<typeof import("@/lib/api-client")>("@/lib/api-client");
  return {
    ...real,
    listarAdicionais,
    listarTiposDeAdicional,
    criarAdicional,
    editarAdicional,
  };
});

const RAQUETE: Adicional = {
  id: "a1",
  tipoId: "t1",
  tipoNome: "Raquetes",
  nome: "Raquete",
  preco: 15,
  estoque: 4,
  ativo: true,
};

beforeEach(() => {
  for (const f of [listarAdicionais, listarTiposDeAdicional, criarAdicional, editarAdicional]) {
    f.mockReset();
  }
  listarAdicionais.mockResolvedValue([RAQUETE]);
  listarTiposDeAdicional.mockResolvedValue([{ id: "t1", nome: "Raquetes", ordem: 0 }]);
});

describe("AdicionaisManager — SPEC-054/D12", () => {
  it("lista com tipo, preço e estoque", async () => {
    render(<AdicionaisManager />);
    const linha = (await screen.findByText("Raquete")).closest("tr") as HTMLElement;
    expect(within(linha).getByText("Raquetes")).toBeInTheDocument();
    expect(within(linha).getByText("R$ 15,00")).toBeInTheDocument();
    expect(within(linha).getByText("4")).toBeInTheDocument();
  });

  it("cria com tipo, nome, preço em reais e estoque", async () => {
    criarAdicional.mockResolvedValue({ ...RAQUETE, id: "a2", nome: "Bola" });
    render(<AdicionaisManager />);
    await screen.findByText("Raquete");

    fireEvent.change(screen.getByLabelText("Nome do adicional"), { target: { value: "Bola" } });
    fireEvent.change(screen.getByLabelText("Preço (R$)"), { target: { value: "5.50" } });
    fireEvent.change(screen.getByLabelText("Estoque"), { target: { value: "10" } });
    fireEvent.click(screen.getByRole("button", { name: "Adicionar" }));

    await waitFor(() =>
      expect(criarAdicional).toHaveBeenCalledWith({
        tipoId: "t1",
        nome: "Bola",
        preco: 5.5,
        estoque: 10,
      }),
    );
  });

  it("D13: baixar o estoque abaixo do reservado mostra os horários que ficaram acima", async () => {
    editarAdicional.mockResolvedValue({
      ...RAQUETE,
      estoque: 1,
      horariosAcimaDoEstoque: [
        { data: "2026-10-01", horaInicio: "09:00", horaFim: "10:00", reservado: 2 },
      ],
    });
    render(<AdicionaisManager />);
    fireEvent.click(await screen.findByRole("button", { name: "Editar Raquete" }));
    fireEvent.change(screen.getByLabelText("Estoque de Raquete"), { target: { value: "1" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar Raquete" }));

    await waitFor(() =>
      expect(editarAdicional).toHaveBeenCalledWith("a1", {
        tipoId: "t1",
        preco: 15,
        estoque: 1,
      }),
    );
    const aviso = await screen.findByRole("status");
    expect(aviso).toHaveTextContent("Raquete ficou acima do estoque em 1 horário");
    expect(aviso).toHaveTextContent("01/10/2026 09:00–10:00: 2 reservadas");
  });

  it("tirar de oferta é desativar — não há botão de apagar", async () => {
    editarAdicional.mockResolvedValue({ ...RAQUETE, ativo: false, horariosAcimaDoEstoque: [] });
    render(<AdicionaisManager />);
    fireEvent.click(await screen.findByRole("button", { name: "Desativar Raquete" }));
    await waitFor(() =>
      expect(editarAdicional).toHaveBeenCalledWith("a1", { ativo: false }),
    );
    expect(screen.queryByRole("button", { name: /Apagar/ })).toBeNull();
  });
});
