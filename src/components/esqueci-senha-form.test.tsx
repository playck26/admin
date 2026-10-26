import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EsqueciSenhaForm, TEXTO_DO_PEDIDO_ENVIADO } from "./esqueci-senha-form";

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

    expect(await screen.findByRole("status")).toHaveTextContent(TEXTO_DO_PEDIDO_ENVIADO);
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
    const primeira = (await screen.findByRole("status")).textContent;
    unmount();

    render(<EsqueciSenhaForm />);
    pedir("nao-existe@lugar-nenhum.com");
    const segunda = (await screen.findByRole("status")).textContent;

    expect(primeira).toBe(TEXTO_DO_PEDIDO_ENVIADO);
    expect(segunda).toBe(primeira);
  });

  it("429: mostra a mensagem do servidor e o formulário fica", async () => {
    fetchMock.mockResolvedValue(
      resposta(429, { statusCode: 429, message: "Muitas tentativas. Aguarde alguns minutos." }),
    );
    render(<EsqueciSenhaForm />);
    pedir("gestor@clube.com");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Muitas tentativas. Aguarde alguns minutos.",
    );
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
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
    await screen.findByRole("status");
    await waitFor(() =>
      expect(screen.getByRole("link", { name: "Voltar ao login" })).toHaveAttribute("href", "/login"),
    );
  });
});
