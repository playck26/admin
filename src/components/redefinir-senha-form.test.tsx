import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RedefinirSenhaForm, TEXTO_LINK_DE_REDEFINICAO_INVALIDO } from "./redefinir-senha-form";
import { LOGIN_APOS_REDEFINICAO } from "./login-form";
import { metadata } from "@/app/redefinir-senha/[token]/page";

/**
 * SPEC-090/AC-025 — `/redefinir-senha/[token]` no Admin: uma conta, `410`, e
 * resposta de duas contas (estado inválido, sem lista).
 *
 * O `fetch` é simulado (e não a `api-client`): o teste confere a rota, o
 * corpo e o `referrerPolicy` que saem de verdade.
 */
const replaceMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock, push: vi.fn() }),
}));

const fetchMock = vi.fn();
const TOKEN = "t".repeat(43);

const CONTA_GESTOR = {
  usuarioId: "11111111-1111-4111-8111-111111111111",
  papel: "company_admin" as const,
  empresa: { nome: "Arena Beira-Mar", logoUrl: null },
};
const OUTRA_CONTA = {
  usuarioId: "22222222-2222-4222-8222-222222222222",
  papel: "aluno" as const,
  empresa: { nome: "Clube Dois", logoUrl: null },
};

const CORPO_410 = {
  statusCode: 410,
  code: "LINK_INVALIDO",
  message: 'Este link não vale mais. Peça outro em "Esqueceu a senha?".',
};

function resposta(status: number, corpo?: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => {
      if (corpo === undefined) throw new SyntaxError("sem corpo");
      return corpo;
    },
  };
}

function chamadas() {
  return fetchMock.mock.calls as [string, RequestInit | undefined][];
}

function preencher(senha: string, confirmacao: string) {
  fireEvent.change(screen.getByLabelText("Senha nova"), { target: { value: senha } });
  fireEvent.change(screen.getByLabelText("Repita a senha nova"), { target: { value: confirmacao } });
  fireEvent.click(screen.getByRole("button", { name: "Redefinir minha senha" }));
}

async function esperarLinkInvalido() {
  expect(await screen.findByRole("alert")).toHaveTextContent(TEXTO_LINK_DE_REDEFINICAO_INVALIDO);
  expect(screen.getByRole("link", { name: "Pedir outro link" })).toHaveAttribute("href", "/esqueci-senha");
  expect(screen.queryByLabelText("Senha nova")).not.toBeInTheDocument();
}

describe("RedefinirSenhaForm (SPEC-090/AC-025)", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    replaceMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("a página do token declara referrer no-referrer na metadata", () => {
    expect(metadata.referrer).toBe("no-referrer");
  });

  it("uma conta: o formulário direto, com o clube e o papel; o GET sai sem Referer", async () => {
    fetchMock.mockResolvedValueOnce(resposta(200, { contas: [CONTA_GESTOR] }));
    render(<RedefinirSenhaForm token={TOKEN} />);

    expect(await screen.findByLabelText("Senha nova")).toBeInTheDocument();
    expect(screen.getByText("Arena Beira-Mar")).toBeInTheDocument();
    expect(screen.getByText("Gestor")).toBeInTheDocument();
    // Sem lista no Admin: nenhum card de escolha, nenhum "Voltar".
    expect(screen.queryByRole("button", { name: /Redefinir a senha de/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Voltar" })).not.toBeInTheDocument();

    const [url, init] = chamadas()[0];
    expect(url).toMatch(new RegExp(`/api/v1/public/redefinicao/${TOKEN}$`));
    expect(init?.referrerPolicy).toBe("no-referrer");
  });

  it("204: manda a senha da conta e vai para o login com o aviso; o POST sai sem Referer", async () => {
    fetchMock
      .mockResolvedValueOnce(resposta(200, { contas: [CONTA_GESTOR] }))
      .mockResolvedValueOnce(resposta(204));
    render(<RedefinirSenhaForm token={TOKEN} />);
    await screen.findByLabelText("Senha nova");

    preencher("senha-nova-123", "senha-nova-123");

    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith(LOGIN_APOS_REDEFINICAO));
    expect(LOGIN_APOS_REDEFINICAO).toBe("/login?senha=redefinida");
    const [url, init] = chamadas()[1];
    expect(url).toMatch(/\/api\/v1\/public\/redefinicao$/);
    expect(init?.method).toBe("POST");
    expect(init?.referrerPolicy).toBe("no-referrer");
    expect(JSON.parse(init?.body as string)).toEqual({
      token: TOKEN,
      usuarioId: CONTA_GESTOR.usuarioId,
      senha: "senha-nova-123",
    });
    // O botão fica desabilitado até a navegação: o link já foi gasto.
    expect(screen.getByRole("button", { name: "Salvando..." })).toBeDisabled();
  });

  it("410 no GET: estado de link inválido com 'Pedir outro link'", async () => {
    fetchMock.mockResolvedValueOnce(resposta(410, CORPO_410));
    render(<RedefinirSenhaForm token={TOKEN} />);
    await esperarLinkInvalido();
  });

  it("410 no POST: o formulário sai e fica o estado de link inválido", async () => {
    fetchMock
      .mockResolvedValueOnce(resposta(200, { contas: [CONTA_GESTOR] }))
      .mockResolvedValueOnce(resposta(410, CORPO_410));
    render(<RedefinirSenhaForm token={TOKEN} />);
    await screen.findByLabelText("Senha nova");

    preencher("senha-nova-123", "senha-nova-123");

    await esperarLinkInvalido();
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it("GET com duas contas: estado de link inválido, sem lista e sem formulário", async () => {
    fetchMock.mockResolvedValueOnce(resposta(200, { contas: [CONTA_GESTOR, OUTRA_CONTA] }));
    render(<RedefinirSenhaForm token={TOKEN} />);
    await esperarLinkInvalido();
    expect(screen.queryByText("Arena Beira-Mar")).not.toBeInTheDocument();
    expect(screen.queryByText("Clube Dois")).not.toBeInTheDocument();
  });

  it("GET com zero contas: estado de link inválido", async () => {
    fetchMock.mockResolvedValueOnce(resposta(200, { contas: [] }));
    render(<RedefinirSenhaForm token={TOKEN} />);
    await esperarLinkInvalido();
  });

  it("senha curta ou confirmação diferente não sai para a rede", async () => {
    fetchMock.mockResolvedValueOnce(resposta(200, { contas: [CONTA_GESTOR] }));
    render(<RedefinirSenhaForm token={TOKEN} />);
    await screen.findByLabelText("Senha nova");

    preencher("1234567", "1234567");
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "A senha precisa ter pelo menos 8 caracteres.",
    );
    preencher("senha-nova-123", "senha-nova-124");
    expect(await screen.findByRole("alert")).toHaveTextContent("As duas senhas não são iguais.");

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("falha de rede no GET não vira link inválido: 'Tentar de novo' busca outra vez", async () => {
    fetchMock
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(resposta(200, { contas: [CONTA_GESTOR] }));
    render(<RedefinirSenhaForm token={TOKEN} />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível abrir o link.");
    expect(screen.queryByRole("link", { name: "Pedir outro link" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));

    expect(await screen.findByLabelText("Senha nova")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
