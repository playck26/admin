import { describe, expect, it } from "vitest";
import { ADMIN_NAV_ITEMS, adminItemIsActive } from "./admin-navigation";

/**
 * A navegação do painel (2026-08-26).
 *
 * **Este arquivo nasceu de um defeito que eu criei na SPEC-020/TASK-005.** A
 * tela de catálogos mora em `/quadras/catalogos`, e `adminItemIsActive` usava
 * `startsWith` — então naquela rota **duas** entradas ficavam acesas ao mesmo
 * tempo: "Quadras", por prefixo, e "Esportes e pisos", por igualdade.
 *
 * Menu com dois itens ativos não é feio, é **enganoso**: a pessoa não sabe
 * onde está, e o "voltar" que ela imagina não é o que o botão faz.
 *
 * O `startsWith` continua necessário — `/quadras/[id]` precisa acender
 * "Quadras". O que mudou é que agora ele só vale quando **nenhum item mais
 * específico** casa.
 */

describe("adminItemIsActive", () => {
  it("a rota exata acende o item", () => {
    expect(adminItemIsActive("/quadras", "/quadras")).toBe(true);
  });

  it("uma sub-rota acende o item pai", () => {
    // `/quadras/[id]` precisa acender "Quadras" — é por isso que o
    // `startsWith` existe.
    expect(adminItemIsActive("/quadras/abc-123", "/quadras")).toBe(true);
  });

  it("rota de outro item não acende", () => {
    expect(adminItemIsActive("/turmas", "/quadras")).toBe(false);
  });

  it("prefixo parcial de palavra NÃO acende", () => {
    // `/quadrasx` não é sub-rota de `/quadras`. Sem a barra na comparação,
    // acenderia.
    expect(adminItemIsActive("/quadrasx", "/quadras")).toBe(false);
  });

  describe("em `/quadras/catalogos` — o defeito que originou este arquivo", () => {
    const ATUAL = "/quadras/catalogos";

    it("acende SÓ o item de catálogos", () => {
      const acesos = ADMIN_NAV_ITEMS.filter((item) =>
        adminItemIsActive(ATUAL, item.href),
      ).map((item) => item.href);

      expect(acesos).toEqual(["/quadras/catalogos"]);
    });

    it("NÃO acende Quadras junto", () => {
      expect(adminItemIsActive(ATUAL, "/quadras")).toBe(false);
    });
  });

  describe("a garantia geral, para as rotas que existem", () => {
    it("nenhuma rota do menu acende mais de um item", () => {
      // Varredura sobre o próprio menu: se alguém acrescentar
      // `/turmas/algo` como item novo, este teste cai — e é exatamente
      // quando alguém precisa ser avisado.
      for (const item of ADMIN_NAV_ITEMS) {
        const acesos = ADMIN_NAV_ITEMS.filter((outro) =>
          adminItemIsActive(item.href, outro.href),
        );
        expect(acesos.map((a) => a.href)).toEqual([item.href]);
      }
    });

    it("uma sub-rota acende exatamente um item", () => {
      for (const sub of [
        "/quadras/abc",
        "/quadras/catalogos",
        "/turmas/xyz",
        "/pessoas/professores/123",
      ]) {
        const acesos = ADMIN_NAV_ITEMS.filter((item) =>
          adminItemIsActive(sub, item.href),
        );
        expect(acesos).toHaveLength(1);
      }
    });
  });
});
