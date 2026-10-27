import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  EsqueciSenhaForm,
  TEXTO_DE_MUITAS_TENTATIVAS,
  TEXTO_DO_PEDIDO_ENVIADO,
} from "./esqueci-senha-form";

/**
 * SPEC-090/AC-025 — `/esqueci-senha` no Admin.
 *
 * O `fetch` é simulado (e não a `api-client`): assim o teste confere também a
 * rota, o método e o corpo que saem de verdade.
 */
const fetchMock = vi.fn();

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

/** A região de status existe desde a montagem; o texto é o que chega depois. */
async function esperarAFrase() {
  await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(TEXTO_DO_PEDIDO_ENVIADO));
  return screen.getByRole("status");
}

function pedir(email: string) {
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: email } });
  fireEvent.click(screen.getByRole("button", { name: "Enviar link" }));
}

describe("EsqueciSenhaForm (SPEC-090/AC-025)", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("202: mostra a frase da D9 e manda o e-mail para POST /auth/esqueci-senha", async () => {
    fetchMock.mockResolvedValue(resposta(202));
    render(<EsqueciSenhaForm />);

    pedir("  gestor@clube.com ");

    await esperarAFrase();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(/\/api\/v1\/auth\/esqueci-senha$/);
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({ email: "gestor@clube.com" });
    // O formulário sai: um segundo envio só gastaria o limite.
    expect(screen.queryByRole("button", { name: "Enviar link" })).not.toBeInTheDocument();
  });

  it("a mesma frase, byte a byte, para e-mails diferentes (o 202 não distingue conta)", async () => {
    fetchMock.mockResolvedValue(resposta(202));
    const { unmount } = render(<EsqueciSenhaForm />);
    pedir("tem-conta@clube.com");
    const primeira = (await esperarAFrase()).textContent;
    unmount();

    render(<EsqueciSenhaForm />);
    pedir("nao-existe@lugar-nenhum.com");
    const segunda = (await esperarAFrase()).textContent;

    expect(primeira).toBe(TEXTO_DO_PEDIDO_ENVIADO);
    expect(segunda).toBe(primeira);
  });

  it("SPEC-090/I9: o texto fixo do 429 é o que o Israel decidiu", () => {
    expect(TEXTO_DE_MUITAS_TENTATIVAS).toBe("Muitas tentativas seguidas. Espere alguns minutos e tente de novo.");
  });

  it("SPEC-090/I9 — 429: o texto fixo, e NÃO a mensagem do servidor; o formulário fica", async () => {
    // A mensagem que o `@nestjs/throttler` manda de verdade, em inglês.
    const DO_SERVIDOR = "ThrottlerException: Too Many Requests";
    fetchMock.mockResolvedValue(resposta(429, { statusCode: 429, message: DO_SERVIDOR }));
    render(<EsqueciSenhaForm />);
    pedir("gestor@clube.com");

    const alerta = await screen.findByRole("alert");
    expect(alerta.textContent).toBe(TEXTO_DE_MUITAS_TENTATIVAS);
    expect(screen.queryByText(DO_SERVIDOR)).toBeNull();
    expect(screen.getAllByRole("status")).toHaveLength(1);
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
    expect(screen.getByRole("button", { name: "Enviar link" })).toBeEnabled();
  });

  it("400: pede para conferir o e-mail, sem dizer que enviou", async () => {
    fetchMock.mockResolvedValue(resposta(400, { statusCode: 400, message: ["email must be an email"] }));
    render(<EsqueciSenhaForm />);
    pedir("isso-nao-e-email");

    expect(await screen.findByRole("alert")).toHaveTextContent("Confira o e-mail digitado.");
    expect(screen.queryByText(TEXTO_DO_PEDIDO_ENVIADO)).not.toBeInTheDocument();
  });

  it("falha de rede: pede para tentar de novo, sem dizer que enviou", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    render(<EsqueciSenhaForm />);
    pedir("gestor@clube.com");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não foi possível pedir o link agora. Tente de novo.",
    );
    expect(screen.queryByText(TEXTO_DO_PEDIDO_ENVIADO)).not.toBeInTheDocument();
  });

  it("e-mail vazio não sai para a rede", async () => {
    render(<EsqueciSenhaForm />);
    pedir("   ");

    expect(await screen.findByRole("alert")).toHaveTextContent("Digite o e-mail da sua conta.");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('"Voltar ao login" nos dois estados', async () => {
    fetchMock.mockResolvedValue(resposta(202));
    render(<EsqueciSenhaForm />);
    expect(screen.getByRole("link", { name: "Voltar ao login" })).toHaveAttribute("href", "/login");

    pedir("gestor@clube.com");
    await esperarAFrase();
    await waitFor(() =>
      expect(screen.getByRole("link", { name: "Voltar ao login" })).toHaveAttribute("href", "/login"),
    );
  });

  /**
   * REV-090-F03 — a região viva existe **vazia** antes do pedido (a que nasce
   * com o texto costuma não ser anunciada), continua uma só depois do `202`, e
   * o foco não cai no `body` quando o formulário sai.
   */
  it("a região de status existe vazia desde a montagem e é a mesma que recebe a frase", async () => {
    fetchMock.mockResolvedValue(resposta(202));
    render(<EsqueciSenhaForm />);

    const regiao = screen.getByRole("status");
    expect(regiao).toBeEmptyDOMElement();

    pedir("gestor@clube.com");
    await esperarAFrase();
    // O mesmo nó: o texto entrou numa região que já existia.
    expect(screen.getAllByRole("status")).toHaveLength(1);
    expect(screen.getByRole("status")).toBe(regiao);
  });

  it('depois do 202, o foco vai para "Voltar ao login", e não para o body', async () => {
    fetchMock.mockResolvedValue(resposta(202));
    render(<EsqueciSenhaForm />);

    pedir("gestor@clube.com");
    await esperarAFrase();
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole("link", { name: "Voltar ao login" })),
    );
  });
});
