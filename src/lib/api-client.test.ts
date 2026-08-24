import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, listLevels } from "./api-client";

/**
 * DEF-008 (2026-08-24) — o defeito que sumiu com os dados do painel.
 *
 * O servidor autoriza pelo **token** (`role` e `companyId` das claims); o app
 * navega e filtra pelo `/auth/me`, que lê do **banco**. Quando o papel ou a
 * empresa de alguém muda, os dois discordam até o próximo login — e como 403
 * nunca disparava a renovação, a divergência **não tinha como se resolver
 * sozinha**.
 *
 * No Admin o sintoma foi pior que um erro: `companyId` velho no token escopa
 * toda consulta para a empresa errada, e a tela mostra zero aluno, zero
 * quadra, zero turma — **sem erro nenhum no console**. Dado que some sem
 * mensagem é pior que erro na cara, porque ninguém sabe que há o que
 * investigar.
 */
function respostaDe(status: number, corpo: unknown): Response {
  const fazer = (): Response =>
    ({
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(corpo),
      clone: () => fazer(),
    }) as unknown as Response;
  return fazer();
}

describe("authFetch — sessão com claims velhas (DEF-008)", () => {
  beforeEach(() => {
    window.localStorage.setItem("playck_admin_access_token", "token-velho");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    window.localStorage.clear();
  });

  it("403 puro RENOVA a sessão e repete o pedido", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(respostaDe(403, { message: "Forbidden", statusCode: 403 }))
      .mockResolvedValueOnce(respostaDe(200, { accessToken: "token-novo" }))
      .mockResolvedValueOnce(respostaDe(200, [{ id: "n1", nome: "Iniciante" }]));
    vi.stubGlobal("fetch", fetchMock);

    await expect(listLevels()).resolves.toEqual([{ id: "n1", nome: "Iniciante" }]);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(window.localStorage.getItem("playck_admin_access_token")).toBe(
      "token-novo",
    );
  });

  it("403 que persiste depois da renovação continua sendo recusa", async () => {
    // A renovação não pode virar uma forma de insistir até passar.
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(respostaDe(403, { message: "Forbidden", statusCode: 403 }))
      .mockResolvedValueOnce(respostaDe(200, { accessToken: "token-novo" }))
      .mockResolvedValueOnce(respostaDe(403, { message: "Forbidden", statusCode: 403 }));
    vi.stubGlobal("fetch", fetchMock);

    const erro = await listLevels().catch((e: unknown) => e);

    expect(erro).toBeInstanceOf(ApiError);
    expect((erro as ApiError).status).toBe(403);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("200 não passa pela renovação", async () => {
    const fetchMock = vi.fn().mockResolvedValue(respostaDe(200, []));
    vi.stubGlobal("fetch", fetchMock);

    await expect(listLevels()).resolves.toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
