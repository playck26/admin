import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AdicionalDisponivel } from "@/lib/api-client";
import {
  contarBlocos,
  SeletorDeAdicionais,
  type ItemEscolhido,
} from "./seletor-de-adicionais";

/**
 * SPEC-054/D12 — **o seletor de adicionais do gestor**, usado nos três lugares
 * em que ele cria reserva avulsa.
 *
 * O que ele promete: pedir a disponibilidade da data e dos horários escolhidos;
 * não deixar passar do `disponivel`; dizer quanto somam; e **sumir** quando o
 * clube não tem adicional ativo — inclusive quando o `back` ainda não conhece a
 * rota (`404` vira lista vazia no cliente).
 */

const adicionaisDisponiveis = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api-client", async () => {
  const real =
    await vi.importActual<typeof import("@/lib/api-client")>("@/lib/api-client");
  return { ...real, adicionaisDisponiveis };
});

const RAQUETE: AdicionalDisponivel = {
  id: "a1",
  tipoId: "t1",
  tipoNome: "Raquetes",
  nome: "Raquete",
  preco: 15,
  disponivel: 2,
};
const BOLA: AdicionalDisponivel = {
  id: "a2",
  tipoId: "t1",
  tipoNome: "Raquetes",
  nome: "Bola",
  preco: 5,
  disponivel: 0,
};

beforeEach(() => {
  adicionaisDisponiveis.mockReset();
});

function montar(onChange = vi.fn()) {
  render(
    <SeletorDeAdicionais
      data="2026-10-01"
      slots={["09:00-10:00", "10:00-11:00"]}
      onChange={onChange}
    />,
  );
  return onChange;
}

describe("contarBlocos — o adicional vale para cada reserva do pedido (D6)", () => {
  it("horários seguidos são um bloco; separados, dois", () => {
    expect(contarBlocos(["09:00-10:00", "10:00-11:00"])).toBe(1);
    expect(contarBlocos(["15:00-16:00", "09:00-10:00"])).toBe(2);
    expect(contarBlocos([])).toBe(0);
  });
});

describe("SeletorDeAdicionais — SPEC-054/D12", () => {
  it("pede a disponibilidade da data e dos horários do pedido", async () => {
    adicionaisDisponiveis.mockResolvedValue([RAQUETE]);
    montar();
    await screen.findByText("Raquete");
    expect(adicionaisDisponiveis).toHaveBeenCalledWith("2026-10-01", [
      "09:00-10:00",
      "10:00-11:00",
    ]);
  });

  it("clube sem adicional ativo: o seletor não aparece", async () => {
    adicionaisDisponiveis.mockResolvedValue([]);
    const { container } = render(
      <SeletorDeAdicionais
        data="2026-10-01"
        slots={["09:00-10:00"]}
        onChange={vi.fn()}
      />,
    );
    await waitFor(() => expect(adicionaisDisponiveis).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it("+ vai até o disponível e para; − volta a zero; a soma acompanha", async () => {
    adicionaisDisponiveis.mockResolvedValue([RAQUETE]);
    const onChange = montar();
    const mais = await screen.findByRole("button", { name: "Mais Raquete" });
    const menos = screen.getByRole("button", { name: "Menos Raquete" });

    expect(menos).toBeDisabled();
    fireEvent.click(mais);
    fireEvent.click(mais);
    expect(mais).toBeDisabled();
    expect(screen.getByText("2")).toBeInTheDocument();

    const ultimo = onChange.mock.calls.at(-1) as [ItemEscolhido[], number];
    expect(ultimo).toEqual([[{ adicionalId: "a1", quantidade: 2 }], 30]);

    fireEvent.click(menos);
    fireEvent.click(menos);
    const zerado = onChange.mock.calls.at(-1) as [ItemEscolhido[], number];
    expect(zerado).toEqual([[], 0]);
  });

  it("adicional sem unidade no horário aparece, mas não deixa escolher", async () => {
    adicionaisDisponiveis.mockResolvedValue([BOLA]);
    montar();
    expect(await screen.findByText("Bola")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mais Bola" })).toBeDisabled();
    expect(screen.getByText(/esgotado neste horário/i)).toBeInTheDocument();
  });
});
