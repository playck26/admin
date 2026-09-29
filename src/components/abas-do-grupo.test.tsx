import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AbasDoGrupo } from "./abas-do-grupo";

/**
 * SPEC-080/AC-004, AC-005 — as duas abas de cada grupo, como links para as
 * rotas que já existiam, e a ativa pelo endereço.
 */
const rota = vi.hoisted(() => ({ atual: "/quadras" }));
vi.mock("next/navigation", () => ({ usePathname: () => rota.atual }));

afterEach(cleanup);

function abas(nome: string) {
  const nav = screen.getByRole("navigation", { name: nome });
  return Array.from(nav.querySelectorAll("a")).map((a) => ({
    texto: a.textContent,
    href: a.getAttribute("href"),
    atual: a.getAttribute("aria-current"),
  }));
}

describe("SPEC-080/AC-004 — Quadras | Esportes e pisos", () => {
  it("em /quadras, a aba Quadras é a ativa, e a outra leva a /quadras/catalogos", () => {
    rota.atual = "/quadras";
    render(<AbasDoGrupo grupo="quadras" />);
    expect(abas("Quadras")).toEqual([
      { texto: "Quadras", href: "/quadras", atual: "page" },
      { texto: "Esportes e pisos", href: "/quadras/catalogos", atual: null },
    ]);
  });

  it("em /quadras/catalogos, só Esportes e pisos acende — `/quadras` é prefixo, e não pode acender junto", () => {
    rota.atual = "/quadras/catalogos";
    render(<AbasDoGrupo grupo="quadras" />);
    expect(abas("Quadras").map((a) => a.atual)).toEqual([null, "page"]);
  });
});

describe("SPEC-080/AC-005 — Adicionais | Tipos de adicional", () => {
  it("em /reservas/adicionais, Adicionais é a ativa", () => {
    rota.atual = "/reservas/adicionais";
    render(<AbasDoGrupo grupo="adicionais" />);
    expect(abas("Adicionais")).toEqual([
      { texto: "Adicionais", href: "/reservas/adicionais", atual: "page" },
      { texto: "Tipos de adicional", href: "/reservas/tipos", atual: null },
    ]);
  });

  it("em /reservas/tipos, só Tipos de adicional acende", () => {
    rota.atual = "/reservas/tipos";
    render(<AbasDoGrupo grupo="adicionais" />);
    expect(abas("Adicionais").map((a) => a.atual)).toEqual([null, "page"]);
  });
});
