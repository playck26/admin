import { describe, expect, it } from "vitest";
import { ADMIN_NAV_ITEMS, adminItemIsActive } from "./admin-navigation";

/**
 * A navegação do painel.
 *
 * **Este arquivo nasceu de um defeito da SPEC-020/TASK-005:** com
 * `/quadras/catalogos` no menu ao lado de `/quadras`, aquela rota acendia DUAS
 * entradas — uma por igualdade, outra por prefixo. Menu com dois itens ativos é
 * enganoso: a pessoa não sabe onde está. A regra ficou: **o item mais específico
 * ganha**, e a comparação de prefixo usa a barra (`/quadrasx` não é sub-rota).
 *
 * **SPEC-053/D6 — "Quadras" e "Esportes e pisos" viraram UM item, "Reservas"**,
 * que acende em `/reservas` e em `/quadras` e subcaminhos. As rotas de quadra não
 * mudaram de endereço (categoria C): mudou o item que as representa no menu.
 */

const acesos = (rota: string) =>
  ADMIN_NAV_ITEMS.filter((item) => adminItemIsActive(rota, item.href)).map(
    (item) => item.href,
  );

describe("SPEC-053/AC-012 — o menu", () => {
  it("tem Reservas, e não tem Quadras nem Esportes e pisos", () => {
    const rotulos = ADMIN_NAV_ITEMS.map((item) => item.label);
    expect(rotulos).toContain("Reservas");
    expect(rotulos).not.toContain("Quadras");
    expect(rotulos).not.toContain("Esportes e pisos");
    expect(ADMIN_NAV_ITEMS.find((i) => i.label === "Reservas")?.href).toBe(
      "/reservas",
    );
  });
});

describe("SPEC-053/AC-014 — onde Reservas acende", () => {
  it.each([
    ["/reservas"],
    ["/quadras"],
    ["/quadras/novo"],
    ["/quadras/abc-123"],
    ["/quadras/catalogos"],
  ])("%s acende Reservas, e só Reservas", (rota) => {
    expect(acesos(rota)).toEqual(["/reservas"]);
  });

  it("prefixo parcial de palavra NÃO acende: /quadrasx e /reservasx", () => {
    expect(acesos("/quadrasx")).toEqual([]);
    expect(acesos("/reservasx")).toEqual([]);
  });

  it("rota de outro item não acende Reservas", () => {
    expect(adminItemIsActive("/turmas", "/reservas")).toBe(false);
  });
});

describe("a garantia geral, para as rotas que existem", () => {
  it("nenhuma rota do menu acende mais de um item", () => {
    // Varredura sobre o próprio menu: item novo que dispute rota cai aqui.
    for (const item of ADMIN_NAV_ITEMS) {
      expect(acesos(item.href)).toEqual([item.href]);
    }
  });

  it("uma sub-rota acende exatamente um item", () => {
    for (const sub of [
      "/quadras/abc",
      "/quadras/catalogos",
      "/turmas/xyz",
      "/pessoas/professores/123",
    ]) {
      expect(acesos(sub)).toHaveLength(1);
    }
  });
});
