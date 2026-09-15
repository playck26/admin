import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Court } from "@/lib/api-client";
import { ReservasHub } from "./reservas-hub";

/**
 * SPEC-053/D6, AC-013 — **a página Reservas do painel.**
 *
 * "Quadras" e "Esportes e pisos" deixaram de ser itens soltos do menu e viraram
 * cartões desta página. As rotas de quadra não mudam (categoria C da D1): o
 * cartão leva a elas. A SPEC-054 acrescenta aqui os cartões de adicionais.
 */

const listCourts = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api-client", async () => {
  const real =
    await vi.importActual<typeof import("@/lib/api-client")>("@/lib/api-client");
  return { ...real, listCourts };
});

function quadra(id: string, status: Court["status"]): Court {
  return {
    id,
    companyId: "c1",
    nome: `Quadra ${id}`,
    esporte: null,
    categoria: null,
    precoHora: 100,
    status,
    createdAt: "2026-09-01T00:00:00.000Z",
    imagemUrl: null,
  };
}

beforeEach(() => {
  listCourts.mockReset();
});

describe("ReservasHub — SPEC-053/AC-013", () => {
  it("mostra o cartão Quadras, com a contagem de ATIVAS, levando a /quadras", async () => {
    listCourts.mockResolvedValue({
      data: [quadra("1", "ativa"), quadra("2", "ativa"), quadra("3", "inativa")],
      page: 1,
      pageSize: 100,
      total: 3,
    });

    render(<ReservasHub />);

    const cartao = await screen.findByRole("link", { name: /Quadras/ });
    expect(cartao).toHaveAttribute("href", "/quadras");
    expect(await screen.findByText("2 ativas")).toBeInTheDocument();
  });

  it("mostra o cartão Esportes e pisos, levando a /quadras/catalogos", async () => {
    listCourts.mockResolvedValue({ data: [], page: 1, pageSize: 100, total: 0 });

    render(<ReservasHub />);

    expect(
      await screen.findByRole("link", { name: /Esportes e pisos/ }),
    ).toHaveAttribute("href", "/quadras/catalogos");
  });

  it("a falha da contagem não derruba os cartões", async () => {
    // A contagem é informação de canto; o caminho para o cadastro é o que a
    // pessoa veio buscar.
    listCourts.mockRejectedValue(new Error("rede"));

    render(<ReservasHub />);

    expect(await screen.findByRole("link", { name: /Quadras/ })).toHaveAttribute(
      "href",
      "/quadras",
    );
  });
});
