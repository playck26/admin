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

  // SPEC-080 (2026-09-29): o cartão "Esportes e pisos" saiu desta página —
  // virou a segunda aba de Quadras (`abas-do-grupo.test.tsx`).

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
  // SPEC-080: "Tipos de adicional" virou a segunda aba de Adicionais; aqui
  // fica só o cartão que leva ao grupo.
  it("o cartão Adicionais leva à tela dos adicionais", async () => {
    listCourts.mockResolvedValue({ data: [], page: 1, pageSize: 100, total: 0 });

    render(<ReservasHub />);

    expect(
      await screen.findByRole("link", { name: /^Adicionais/ }),
    ).toHaveAttribute("href", "/reservas/adicionais");
  });

  it("o cartão Nomes para o cliente fica na própria página", async () => {
    listCourts.mockResolvedValue({ data: [], page: 1, pageSize: 100, total: 0 });

    render(<ReservasHub />);

    expect(await screen.findByLabelText("Nome para Quadra")).toBeInTheDocument();
  });
});

/**
 * SPEC-080 (card 5360, reaberto em 2026-09-29) — **dois itens, e as abas
 * dentro.** A SPEC-061 tinha agrupado os quatro cartões sob dois títulos, e o
 * Israel viu em produção a mesma coisa: *"eu quero apenas 2 itens na primeira
 * página"*. O que estes testes protegem: são DOIS cartões, cada um nomeia as
 * duas abas que abre, e o "Nomes para o cliente" continua embaixo (I2). A
 * outra metade — que as abas levam às duas telas de cada grupo — está em
 * `abas-do-grupo.test.tsx`.
 */
describe("SPEC-080/AC-001 — a página Reservas tem dois itens", () => {
  beforeEach(() => {
    listCourts.mockResolvedValue({ data: [], page: 1, pageSize: 100, total: 0 });
  });

  it("exatamente dois cartões: Quadras e Adicionais, cada um levando à primeira aba", async () => {
    render(<ReservasHub />);
    await screen.findByRole("link", { name: /^Adicionais/ });

    const destinos = screen
      .getAllByRole("link")
      .map((a) => a.getAttribute("href"));
    expect(destinos).toEqual(["/quadras", "/reservas/adicionais"]);
  });

  it("Esportes e pisos e Tipos de adicional não são mais cartão — e cada cartão diz que eles estão lá dentro", async () => {
    render(<ReservasHub />);

    const quadras = await screen.findByRole("link", { name: /^Quadras/ });
    const adicionais = screen.getByRole("link", { name: /^Adicionais/ });
    expect(quadras).toHaveTextContent(/esportes e pisos/);
    expect(adicionais).toHaveTextContent(/tipos/);
    expect(
      screen.queryByRole("link", { name: /^Esportes e pisos/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /^Tipos de adicional/ }),
    ).not.toBeInTheDocument();
  });

  it("AC-003: o Nomes para o cliente continua embaixo dos dois", async () => {
    render(<ReservasHub />);

    expect(await screen.findByLabelText("Nome para Quadra")).toBeInTheDocument();
  });
});
