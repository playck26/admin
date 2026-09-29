import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import QuadrasPage from "@/app/(app)/quadras/page";
import CatalogosDeQuadraPage from "@/app/(app)/quadras/catalogos/page";
import NovaQuadraPage from "@/app/(app)/quadras/novo/page";
import AdicionaisPage from "@/app/(app)/reservas/adicionais/page";
import TiposDeAdicionalPage from "@/app/(app)/reservas/tipos/page";

/**
 * SPEC-080/AC-004, AC-005, AC-007 — **as páginas usam as abas** (e a página
 * final não). O `abas-do-grupo.test.tsx` prova o componente; sem este arquivo,
 * tirar as abas de uma página passaria por todos os testes.
 *
 * O conteúdo de cada página é simulado: o que está em julgamento é o que a
 * página põe no topo, não a lista de quadras ou de adicionais.
 */
const rota = vi.hoisted(() => ({ atual: "/quadras" }));
vi.mock("next/navigation", () => ({
  usePathname: () => rota.atual,
  useRouter: () => ({ push: vi.fn(), back: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("@/components/courts-list", () => ({ CourtsList: () => <p>lista de quadras</p> }));
vi.mock("@/components/catalogo-de-quadra-manager", () => ({
  CatalogoDeQuadraManager: () => <p>catálogo</p>,
}));
vi.mock("@/components/adicionais-manager", () => ({
  AdicionaisManager: () => <p>adicionais</p>,
}));
vi.mock("@/components/tipos-de-adicional-manager", () => ({
  TiposDeAdicionalManager: () => <p>tipos</p>,
}));
vi.mock("@/components/create-court-form", () => ({
  CreateCourtForm: () => <p>cadastro de quadra</p>,
}));

afterEach(cleanup);

const abaAtiva = (grupo: string) =>
  screen
    .getByRole("navigation", { name: grupo })
    .querySelector('a[aria-current="page"]')?.textContent;

describe("SPEC-080 — cada página do grupo abre com as abas, na aba certa", () => {
  it.each([
    ["/quadras", "Quadras", "Quadras", QuadrasPage],
    ["/quadras/catalogos", "Quadras", "Esportes e pisos", CatalogosDeQuadraPage],
    ["/reservas/adicionais", "Adicionais", "Adicionais", AdicionaisPage],
    ["/reservas/tipos", "Adicionais", "Tipos de adicional", TiposDeAdicionalPage],
  ] as const)("%s: abas de %s, com %s ativa", (url, grupo, ativa, Pagina) => {
    rota.atual = url;
    render(<Pagina />);
    expect(abaAtiva(grupo)).toBe(ativa);
  });

  it("AC-007: o cadastro de quadra é página final — sem abas", () => {
    rota.atual = "/quadras/novo";
    render(<NovaQuadraPage />);
    expect(screen.getByText("cadastro de quadra")).toBeInTheDocument();
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
  });
});
