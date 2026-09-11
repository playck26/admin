import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CadastrosPendentes } from "./cadastros-pendentes";

/**
 * SPEC-049/REQ-003 — a fila de aprovação.
 *
 * **Este card não tinha teste nenhum**, e é onde morava o defeito: ele mostrava
 * `pendentes.length` como se fosse o total. Com a página travada em 100, dizia
 * **"(100)"** para 340 esperando — e a ordem `createdAt: 'desc'` fazia sumir
 * justamente os mais antigos, quem esperou mais.
 *
 * O servidor sempre mandou `total` na mesma resposta.
 */
const listar = vi.hoisted(() => vi.fn());
const aprovar = vi.hoisted(() => vi.fn());
const recusar = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api-client", async () => {
  const real =
    await vi.importActual<typeof import("@/lib/api-client")>(
      "@/lib/api-client",
    );
  return {
    ...real,
    listStudentsPendentes: listar,
    aprovarAluno: aprovar,
    recusarAluno: recusar,
  };
});

function pagina(nomes: string[], total: number, page = 1, pageSize = 20) {
  return {
    data: nomes.map((nome, i) => ({
      id: `a-${page}-${i}`,
      nome,
      email: `${nome}@x.com`,
      telefone: null,
    })),
    total,
    page,
    pageSize,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  listar.mockResolvedValue(pagina(["Ana", "Bruno"], 2));
  aprovar.mockResolvedValue(undefined);
  recusar.mockResolvedValue(undefined);
});

describe("CadastrosPendentes", () => {
  it("fila vazia não ocupa o topo da tela", async () => {
    listar.mockResolvedValue(pagina([], 0));
    const { container } = render(<CadastrosPendentes onDecidir={vi.fn()} />);
    await waitFor(() => expect(listar).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it("**AC-009: o número é o TOTAL do servidor, não o tamanho da página**", async () => {
    // O caso que o defeito produzia: 20 na página, 340 esperando.
    listar.mockResolvedValue(pagina(["Ana", "Bruno"], 340));
    render(<CadastrosPendentes onDecidir={vi.fn()} />);

    // Dizer "(2)" aqui seria um número errado apresentado como fato — e o
    // gestor fecharia a fila achando que acabou.
    expect(
      await screen.findByText(/Cadastros aguardando aprovação \(340\)/),
    ).toBeInTheDocument();
  });

  it("**AC-010: pagina, e ninguém fica inalcançável**", async () => {
    listar.mockResolvedValue(pagina(["Ana", "Bruno"], 340));
    render(<CadastrosPendentes onDecidir={vi.fn()} />);
    await screen.findByText("Ana");

    // 340 / 20 = 17 páginas. Sem isto, 320 pessoas eram invisíveis — e, pela
    // ordem `createdAt: 'desc'`, as 320 que esperaram MAIS.
    expect(screen.getByText("Página 1 de 17")).toBeInTheDocument();

    listar.mockResolvedValue(pagina(["Carla"], 340, 2));
    fireEvent.click(screen.getByText("Próxima"));

    await waitFor(() => expect(listar).toHaveBeenLastCalledWith(2));
    expect(await screen.findByText("Carla")).toBeInTheDocument();
  });

  it("uma página só não desenha navegação", async () => {
    render(<CadastrosPendentes onDecidir={vi.fn()} />);
    await screen.findByText("Ana");
    // Botões que não levam a lugar nenhum são ruído.
    expect(screen.queryByText("Próxima")).not.toBeInTheDocument();
  });

  it("**AC-011: aprovar recarrega a página ATUAL, não a primeira**", async () => {
    listar.mockResolvedValue(pagina(["Ana", "Bruno"], 340));
    render(<CadastrosPendentes onDecidir={vi.fn()} />);
    await screen.findByText("Ana");

    listar.mockResolvedValue(pagina(["Carla", "Diego"], 340, 2));
    fireEvent.click(screen.getByText("Próxima"));
    await screen.findByText("Carla");

    listar.mockClear();
    listar.mockResolvedValue(pagina(["Diego"], 339, 2));
    fireEvent.click(screen.getAllByText("Aprovar")[0]);

    // Voltar para a primeira página faria o gestor perder o lugar no meio de
    // uma leva de 340.
    await waitFor(() => expect(listar).toHaveBeenCalledWith(2));
  });

  it("a contagem acompanha a decisão", async () => {
    listar.mockResolvedValue(pagina(["Ana", "Bruno"], 340));
    render(<CadastrosPendentes onDecidir={vi.fn()} />);
    await screen.findByText(/\(340\)/);

    listar.mockResolvedValue(pagina(["Bruno"], 339));
    fireEvent.click(screen.getAllByText("Aprovar")[0]);

    expect(await screen.findByText(/\(339\)/)).toBeInTheDocument();
  });

  it("**a página volta para a que o servidor devolveu**", async () => {
    // Aprovar o último da página 17 pode deixar 16 páginas; insistir na 17
    // mostraria lista vazia com "há 320 esperando".
    listar.mockResolvedValue(pagina(["Ana"], 21, 2));
    render(<CadastrosPendentes onDecidir={vi.fn()} />);
    await screen.findByText("Ana");

    listar.mockResolvedValue(pagina(["Zeca"], 20, 1));
    fireEvent.click(screen.getAllByText("Aprovar")[0]);

    await screen.findByText("Zeca");
    expect(screen.queryByText(/Página 2 de/)).not.toBeInTheDocument();
  });

  it("falha ao carregar não bloqueia a tela de alunos", async () => {
    listar.mockRejectedValue(new Error("rede"));
    const { container } = render(<CadastrosPendentes onDecidir={vi.fn()} />);
    await waitFor(() => expect(listar).toHaveBeenCalled());
    // Fila é informação secundária: some, não derruba.
    expect(container).toBeEmptyDOMElement();
  });
});
