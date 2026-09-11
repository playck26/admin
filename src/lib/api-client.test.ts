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

  /**
   * DEF-028 — o clube suspenso, e por que ele NAO pode cair no ramo do 403
   * generico logo acima.
   *
   * Aquele ramo tenta renovar a sessao. A renovacao de uma empresa suspensa
   * responde `401` e derruba as demais sessoes — a pessoa cairia no login sem
   * uma palavra sobre o motivo. Um logout mudo no meio do trabalho.
   */
  it("**403 EMPRESA_INATIVA encerra a sessao e diz por que**", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      respostaDe(403, {
        statusCode: 403,
        code: "EMPRESA_INATIVA",
        message: "O acesso deste clube está suspenso. Fale com o suporte da plataforma.",
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const erro = await listLevels().catch((e: unknown) => e);

    expect(erro).toBeInstanceOf(ApiError);
    expect((erro as ApiError).message).toMatch(/suporte da plataforma/i);
    // **UMA chamada.** Se caisse no ramo generico seriam tres (pedido,
    // renovacao, repeticao) — e a renovacao derrubaria as outras sessoes.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(window.localStorage.getItem("playck_admin_access_token")).toBeNull();
  });

  it("DEF-028: os DOIS codigos existem e nao se confundem", async () => {
    // **A primeira versao deste caso so afirmava que a mensagem NAO era a da
    // conta inativa — e passava com e sem o desvio.** Vacuidade: o ramo
    // generico tambem nao produz aquela frase. Este compara os dois lado a
    // lado, e e o unico arranjo que reprova quem fundir os ramos ou trocar as
    // mensagens de lugar.
    // **SEM `message` no corpo, de propósito.** Com a mensagem do servidor
    // presente, ela atravessa qualquer um dos ramos e o caso passa mesmo com o
    // desvio removido — foi assim que a primeira versão deste teste passou com
    // a sabotagem. Omitindo-a, o que aparece é o texto PADRÃO de cada ramo, e
    // aí os dois se distinguem: fundir os ramos faz a empresa herdar
    // "procure o administrador".
    // O tipo do `catch` e explicito: `listLevels()` resolve com a lista, e
    // `Promise<Lista | ApiError>` nao tem `.message`. **O runner passou e o
    // `tsc` reprovou**, nos DOIS frontends, pelo mesmo motivo.
    const responder = async (code: string): Promise<ApiError> => {
      const fetchMock = vi
        .fn()
        .mockResolvedValue(respostaDe(403, { statusCode: 403, code }));
      vi.stubGlobal("fetch", fetchMock);
      try {
        await listLevels();
        throw new Error(`esperava ApiError para ${code}`);
      } catch (e) {
        return e as ApiError;
      }
    };

    const daConta = await responder("CONTA_INATIVA");
    window.localStorage.setItem("playck_admin_access_token", "token-velho");
    const daEmpresa = await responder("EMPRESA_INATIVA");

    expect(daConta.message).toMatch(/procure o administrador/i);
    expect(daEmpresa.message).toMatch(/suporte da plataforma/i);
    // Quem suspende clube e o `super_admin`; mandar "procure o administrador"
    // mandaria o gestor procurar a si mesmo.
    expect(daEmpresa.message).not.toMatch(/procure o administrador/i);
  });

  it("200 não passa pela renovação", async () => {
    const fetchMock = vi.fn().mockResolvedValue(respostaDe(200, []));
    vi.stubGlobal("fetch", fetchMock);

    await expect(listLevels()).resolves.toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
