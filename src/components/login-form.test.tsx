import { act, render, screen, fireEvent, waitFor } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LOGIN_APOS_REDEFINICAO, LoginForm, TEXTO_SENHA_REDEFINIDA } from "./login-form";

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

// AC-007 (SPEC-001): login funciona e redireciona para o dashboard.
describe("LoginForm", () => {
  beforeEach(() => {
    pushMock.mockClear();
    vi.stubGlobal("fetch", vi.fn());
  });

  it("renderiza os campos de email e senha", () => {
    render(<LoginForm />);
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Senha")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Entrar" })).toBeInTheDocument();
  });

  it("redireciona para /dashboard após login com sucesso", async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        accessToken: "token-123",
        refreshToken: "refresh-123",
        usuario: { id: "u1", nome: "Admin", role: "company_admin", companyId: "c1" },
      }),
    });

    render(<LoginForm />);
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "admin@x.com" } });
    fireEvent.change(screen.getByLabelText("Senha"), { target: { value: "senha-valida" } });
    fireEvent.click(screen.getByRole("button", { name: "Entrar" }));

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/dashboard"));
  });

  it("mostra mensagem de erro genérica em credenciais inválidas (AC-002)", async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ statusCode: 401, error: "Unauthorized", message: "Credenciais inválidas" }),
    });

    render(<LoginForm />);
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "admin@x.com" } });
    fireEvent.change(screen.getByLabelText("Senha"), { target: { value: "senha-errada" } });
    fireEvent.click(screen.getByRole("button", { name: "Entrar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Credenciais inválidas");
    expect(pushMock).not.toHaveBeenCalled();
  });
});

/**
 * SPEC-090/AC-025 — o "Esqueceu a senha?" e o aviso depois da redefinição.
 *
 * O aviso entra **numa região de status só**, que existe desde o servidor e
 * começa vazia: o texto só aparece depois do efeito que lê o endereço.
 */
describe("LoginForm — esqueci minha senha (SPEC-090)", () => {
  beforeEach(() => {
    pushMock.mockClear();
    vi.stubGlobal("fetch", vi.fn());
  });
  afterEach(() => {
    window.history.replaceState({}, "", "/login");
  });

  it('"Esqueceu a senha?" é link para /esqueci-senha', () => {
    render(<LoginForm />);
    expect(screen.getByRole("link", { name: "Esqueceu a senha?" })).toHaveAttribute(
      "href",
      "/esqueci-senha",
    );
  });

  it(`${LOGIN_APOS_REDEFINICAO}: mostra "${TEXTO_SENHA_REDEFINIDA}" numa região de status só`, async () => {
    window.history.replaceState({}, "", LOGIN_APOS_REDEFINICAO);
    render(<LoginForm />);

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(TEXTO_SENHA_REDEFINIDA));
    expect(screen.getAllByRole("status")).toHaveLength(1);
  });

  it("sem o parâmetro, ou com outro valor, a região existe e fica vazia", async () => {
    for (const busca of ["/login", "/login?senha=1", "/login?senha=redefinida2", "/login?ativado=1"]) {
      window.history.replaceState({}, "", busca);
      const { unmount } = render(<LoginForm />);
      // Dá ao efeito a chance de rodar antes de conferir que não escreveu nada.
      await act(async () => {});
      expect(screen.getAllByRole("status")).toHaveLength(1);
      expect(screen.getByRole("status")).toBeEmptyDOMElement();
      unmount();
    }
  });

  it("no HTML do servidor (sem efeito), a região existe e começa vazia, mesmo vindo da redefinição", () => {
    window.history.replaceState({}, "", LOGIN_APOS_REDEFINICAO);
    const html = renderToString(<LoginForm />);
    const regioes = html.match(/<p[^>]*role="status"[^>]*>(.*?)<\/p>/g) ?? [];
    expect(regioes).toHaveLength(1);
    expect(regioes[0]).toMatch(/<p[^>]*role="status"[^>]*><\/p>/);
    expect(html).not.toContain(TEXTO_SENHA_REDEFINIDA);
  });
});
