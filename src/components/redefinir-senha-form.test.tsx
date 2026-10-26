import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RedefinirSenhaForm, TEXTO_LINK_DE_REDEFINICAO_INVALIDO } from "./redefinir-senha-form";
import {
  ATRASO_DO_ANUNCIO_MS,
  CHAVE_SENHA_REDEFINIDA,
  LOGIN_APOS_REDEFINICAO,
  LoginForm,
  TEXTO_SENHA_REDEFINIDA,
  VALOR_SENHA_REDEFINIDA,
} from "./login-form";
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

/**
 * SPEC-090 (D9), REV-090-F02 — **o outro lado do protocolo: o login que lê
 * `LOGIN_APOS_REDEFINICAO`.** Mora aqui, e não no `login-form.test.tsx`, porque
 * é o contrato desta página com o login, e o teste do login está fora do
 * write-set da TASK-004.
 *
 * Com relógio simulado, o atraso é medido, e não adivinhado: a região nasce
 * vazia no render (depois do efeito), continua vazia um milissegundo antes
 * de `ATRASO_DO_ANUNCIO_MS`, e só então recebe a frase. Preencher no corpo do
 * efeito, sem o atraso, fica vermelho no primeiro `toBeEmptyDOMElement`; e
 * os endereços fora do protocolo esperam bem mais que o atraso antes de
 * conferir que a região continuou vazia.
 */
describe("o login depois da redefinição (SPEC-090/D9, REV-090-F02)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn());
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    window.history.replaceState({}, "", "/");
  });

  it(`${LOGIN_APOS_REDEFINICAO}: a região nasce vazia e a frase só entra depois de ${ATRASO_DO_ANUNCIO_MS} ms`, async () => {
    expect(ATRASO_DO_ANUNCIO_MS).toBe(150);
    window.history.replaceState({}, "", LOGIN_APOS_REDEFINICAO);
    render(<LoginForm />);

    expect(screen.getAllByRole("status")).toHaveLength(1);
    const regiao = screen.getByRole("status");
    expect(regiao).toBeEmptyDOMElement();

    await act(async () => {
      vi.advanceTimersByTime(ATRASO_DO_ANUNCIO_MS - 1);
    });
    expect(regiao).toBeEmptyDOMElement();

    await act(async () => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.getAllByRole("status")).toHaveLength(1);
    expect(regiao.textContent).toBe(TEXTO_SENHA_REDEFINIDA);
    // O aviso informa e não interrompe: o foco não sai de onde está.
    expect(document.activeElement).toBe(document.body);
  });

  it.each(["/login", "/login?senha=1", "/login?senha=Redefinida", "/login?senha=redefinida2", "/login?ativado=1"])(
    "%s: muito depois do atraso, a região continua vazia",
    async (endereco) => {
      window.history.replaceState({}, "", endereco);
      render(<LoginForm />);
      await act(async () => {
        vi.advanceTimersByTime(ATRASO_DO_ANUNCIO_MS * 10);
      });
      expect(screen.getAllByRole("status")).toHaveLength(1);
      expect(screen.getByRole("status")).toBeEmptyDOMElement();
    },
  );

  it("desmontar antes do atraso não escreve nada (o efeito limpa o relógio)", async () => {
    window.history.replaceState({}, "", LOGIN_APOS_REDEFINICAO);
    const { unmount } = render(<LoginForm />);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});

/**
 * SPEC-090 (D9), REV-090-F04 — **o literal do protocolo só existe na
 * constante**, como a varredura do `ativacao-navigation.test.ts` do Cliente.
 * O teste de cima compara com a constante importada; uma segunda cópia do
 * literal, escrita à mão em outra página, teria o mesmo valor e o deixaria
 * verde. Esta varredura é quem a reprova.
 *
 * O alvo é o par escrito à mão (`senha=redefinida`) e o valor como literal
 * entre aspas (`{ senha: "redefinida" }`). O texto do aviso, "Senha
 * redefinida. Entre…", não é nenhum dos dois. Fica de fora só o arquivo da
 * constante (`login-form.tsx`, que declara `VALOR_SENHA_REDEFINIDA`).
 */
const SRC = join(__dirname, "..");
const ARQUIVO_DA_CONSTANTE = "components/login-form.tsx";
const VALOR_ENTRE_ASPAS = new RegExp(`["'\`]${VALOR_SENHA_REDEFINIDA}["'\`]`);

function citaOProtocoloDaRedefinicao(conteudo: string): boolean {
  return (
    conteudo.includes(`${CHAVE_SENHA_REDEFINIDA}=${VALOR_SENHA_REDEFINIDA}`) ||
    VALOR_ENTRE_ASPAS.test(conteudo)
  );
}

function arquivosDeProducao(dir: string): string[] {
  const saida: string[] = [];
  for (const nome of readdirSync(dir)) {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) {
      saida.push(...arquivosDeProducao(caminho));
      continue;
    }
    if (!/\.(tsx?|css|m?js)$/.test(nome)) continue;
    if (/\.test\.(tsx?|m?js)$/.test(nome)) continue;
    if (relative(SRC, caminho).replace(/\\/g, "/") === ARQUIVO_DA_CONSTANTE) continue;
    saida.push(caminho);
  }
  return saida;
}

describe("o literal da redefinição só existe na constante (SPEC-090/D9, REV-090-F04)", () => {
  it("a regra acha o literal escrito à mão, e não acha quem importa a constante nem o texto do aviso", () => {
    expect(citaOProtocoloDaRedefinicao('router.replace("/login?senha=redefinida")')).toBe(true);
    expect(citaOProtocoloDaRedefinicao("router.replace(`/login?senha=redefinida`)")).toBe(true);
    expect(citaOProtocoloDaRedefinicao('new URLSearchParams({ senha: "redefinida" })')).toBe(true);
    expect(citaOProtocoloDaRedefinicao("new URLSearchParams({ senha: 'redefinida' })")).toBe(true);
    expect(citaOProtocoloDaRedefinicao("router.replace(LOGIN_APOS_REDEFINICAO)")).toBe(false);
    expect(citaOProtocoloDaRedefinicao('"Senha redefinida. Entre com a senha nova."')).toBe(false);
    // A constante é o que a regra procura: se ela não achasse o próprio
    // arquivo da constante, não acharia uma cópia dele.
    expect(
      citaOProtocoloDaRedefinicao(readFileSync(join(SRC, ARQUIVO_DA_CONSTANTE), "utf8")),
    ).toBe(true);
  });

  it("nenhum arquivo de produção fora da constante escreve o literal", () => {
    const arquivos = arquivosDeProducao(SRC).map((a) => relative(SRC, a).replace(/\\/g, "/"));
    // Contra a vacuidade: a varredura viu o código de verdade, inclusive o
    // emissor (esta página) e as duas páginas novas.
    expect(arquivos.length).toBeGreaterThan(30);
    expect(arquivos).toContain("components/redefinir-senha-form.tsx");
    expect(arquivos).toContain("components/esqueci-senha-form.tsx");
    expect(arquivos).toContain("app/redefinir-senha/[token]/page.tsx");
    expect(arquivos).not.toContain(ARQUIVO_DA_CONSTANTE);

    const copias = arquivos.filter((a) => citaOProtocoloDaRedefinicao(readFileSync(join(SRC, a), "utf8")));
    expect(copias).toEqual([]);
  });
});
