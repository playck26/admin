import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { Court } from "@/lib/api-client";
import { LegendaDaAgenda } from "./legenda-da-agenda";

/**
 * SPEC-057/TASK-005/D19/AC-033 — **a legenda existe, fica fora da grade e
 * identifica tudo por texto.** A agenda do gestor não tinha legenda (LIM-052c,
 * lacuna declarada de propósito); esta task a encerra.
 */

afterEach(cleanup);

function quadra(i: number, over: Partial<Court> = {}): Court {
  return {
    id: `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`,
    companyId: "c",
    nome: `Quadra ${i}`,
    esporte: null,
    categoria: null,
    precoHora: 80,
    status: "ativa",
    createdAt: "2026-09-01T00:00:00.000Z",
    imagemUrl: null,
    cor: "#00763A",
    codigoAgenda: String(i),
    ...over,
  };
}

describe("LegendaDaAgenda (D19)", () => {
  it("lista os três tipos e os quatro estados, por texto", () => {
    render(<LegendaDaAgenda quadras={[]} />);

    const legenda = screen.getByRole("region", { name: "Legenda da agenda" });
    for (const t of ["Turma", "Reserva", "Particular"]) {
      expect(within(legenda).getByText(t)).toBeInTheDocument();
    }
    for (const e of ["Programada", "Pago", "Pendente", "Cancelada"]) {
      expect(within(legenda).getByText(e)).toBeInTheDocument();
    }
  });

  it("12 quadras, duas homônimas da mesma cor e um nome de 80 caracteres: 12 identificações distintas", () => {
    const quadras = Array.from({ length: 12 }, (_, i) => quadra(i + 1));
    quadras[10] = quadra(11, { nome: "Quadra 1", cor: "#00763A" });
    quadras[11] = quadra(12, { nome: "N".repeat(80), cor: "#A12B65" });

    render(<LegendaDaAgenda quadras={quadras} />);

    const itens = within(
      screen.getByRole("list", { name: "Quadras" }),
    ).getAllByRole("listitem");
    const textos = itens.map((li) => li.textContent);
    expect(itens).toHaveLength(12);
    expect(new Set(textos).size).toBe(12);
    expect(textos).toContain("Quadra 1 · Q-1Verde");
    expect(textos).toContain("Quadra 1 · Q-11Verde");
    expect(textos).toContain(`${"N".repeat(80)} · Q-12Vinho`);
  });

  it("a amostra de cor é decorativa, e o nome da cor vem escrito", () => {
    render(<LegendaDaAgenda quadras={[quadra(1, { cor: "#6B46A3" })]} />);

    const item = screen.getByRole("listitem");
    const amostra = item.querySelector("[data-amostra]") as HTMLElement;
    expect(amostra).toHaveAttribute("aria-hidden", "true");
    expect(amostra.style.backgroundColor).toBe("rgb(107, 70, 163)");
    expect(item).toHaveTextContent("Roxo");
  });
});
