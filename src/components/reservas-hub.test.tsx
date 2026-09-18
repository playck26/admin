import { render, screen, within } from "@testing-library/react";
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
const lerNomesDeTipo = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api-client", async () => {
  const real =
    await vi.importActual<typeof import("@/lib/api-client")>("@/lib/api-client");
  return { ...real, listCourts, lerNomesDeTipo };
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
    // SPEC-057/TASK-005/D19 — cor e código da quadra na agenda.
    cor: "#00763A",
    codigoAgenda: "1",
  };
}

beforeEach(() => {
  listCourts.mockReset();
  lerNomesDeTipo.mockReset();
  lerNomesDeTipo.mockResolvedValue({
    nomeTipoQuadra: "Quadra",
    nomeTipoAula: "Aula particular",
  });
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

describe("ReservasHub — SPEC-054/D12: os adicionais entram na página Reservas", () => {
  it("cartões Adicionais e Tipos de adicional, cada um levando à sua tela", async () => {
    listCourts.mockResolvedValue({ data: [], page: 1, pageSize: 100, total: 0 });

    render(<ReservasHub />);

    expect(
      await screen.findByRole("link", { name: /^Adicionais/ }),
    ).toHaveAttribute("href", "/reservas/adicionais");
    expect(
      screen.getByRole("link", { name: /Tipos de adicional/ }),
    ).toHaveAttribute("href", "/reservas/tipos");
  });

  it("o cartão Nomes para o cliente fica na própria página", async () => {
    listCourts.mockResolvedValue({ data: [], page: 1, pageSize: 100, total: 0 });

    render(<ReservasHub />);

    expect(await screen.findByLabelText("Nome para Quadra")).toBeInTheDocument();
  });
});

/**
 * SPEC-061/TASK-001 (card 5360) — **os quatro cartões viraram dois grupos.**
 *
 * O pedido do Israel foi de navegação, não de conteúdo: *"agrupasse os itens
 * adicional e tipo adicionais, assim como quadras com esportes e pisos"*. Por
 * isso o que estes testes protegem é **o agrupamento E a integridade dos
 * quatro destinos** — agrupar não pode ter custado um caminho.
 */
describe("SPEC-061 — Reservas em dois grupos", () => {
  // A contagem das quadras é informação de canto; o que estes testes julgam é
  // o agrupamento. Uma lista vazia basta e mantém o teste sobre o assunto.
  beforeEach(() => {
    listCourts.mockResolvedValue({ data: [], page: 1, pageSize: 100, total: 0 });
  });

  it("mostra os dois grupos, com o cartão certo em cada um", async () => {
    render(<ReservasHub />);

    const quadras = await screen.findByRole("region", { name: "Quadras" });
    expect(within(quadras).getByRole("link", { name: /Quadras/ })).toHaveAttribute(
      "href",
      "/quadras",
    );
    expect(
      within(quadras).getByRole("link", { name: /Esportes e pisos/ }),
    ).toHaveAttribute("href", "/quadras/catalogos");

    const adicionais = await screen.findByRole("region", { name: "Adicionais" });
    expect(
      within(adicionais).getByRole("link", { name: /^Adicionais/ }),
    ).toHaveAttribute("href", "/reservas/adicionais");
    expect(
      within(adicionais).getByRole("link", { name: /Tipos de adicional/ }),
    ).toHaveAttribute("href", "/reservas/tipos");
  });

  // Agrupar não pode ter perdido destino: os quatro continuam a um clique.
  it("os quatro destinos continuam na página", async () => {
    render(<ReservasHub />);
    await screen.findByRole("region", { name: "Quadras" });

    const hrefs = screen.getAllByRole("link").map((a) => a.getAttribute("href"));
    for (const destino of [
      "/quadras",
      "/quadras/catalogos",
      "/reservas/adicionais",
      "/reservas/tipos",
    ]) {
      expect(hrefs).toContain(destino);
    }
  });
});
