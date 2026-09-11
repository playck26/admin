import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api-client";
import { VencimentosCard } from "./vencimentos-card";

/**
 * SPEC-045/REQ-003 — a tela dos dois grupos.
 *
 * **O que este arquivo guarda:** que os dois grupos apareçam separados e
 * nomeados, que a janela seja escolha do gestor, e que `diasRestantes`
 * negativo vire *"venceu há N dias"* e não *"vence em -N dias"*.
 *
 * Que a lista não confunda **upgrade** com vencimento está em
 * `spec-045-vencimento.db-spec.ts`, sobre dados reais — aqui o servidor é
 * dublê, e um dublê que devolve a lista que eu escrevi provaria só que eu sei
 * escrever listas.
 */
const listarVencimentos = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api-client", async () => {
  const real =
    await vi.importActual<typeof import("@/lib/api-client")>(
      "@/lib/api-client",
    );
  return { ...real, listarVencimentos };
});

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>,
}));

function linha(nome: string, dias: number) {
  return {
    alunoId: `id-${nome}`,
    alunoNome: nome,
    planoNome: "Mensal",
    fim: "2026-10-12",
    diasRestantes: dias,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  listarVencimentos.mockResolvedValue({ dias: 30, vencidas: [], vencendo: [] });
});

describe("SPEC-045 — card de vencimentos", () => {
  it("mostra os dois grupos com a contagem de cada um", async () => {
    listarVencimentos.mockResolvedValue({
      dias: 30,
      vencidas: [linha("Ana", -5), linha("Bruno", -1)],
      vencendo: [linha("Carla", 3)],
    });

    render(<VencimentosCard />);

    expect(await screen.findByText("Vencidas (2)")).toBeInTheDocument();
    expect(screen.getByText("Vencendo (1)")).toBeInTheDocument();
  });

  it("**`diasRestantes` negativo vira 'venceu há', não 'vence em -5'**", async () => {
    listarVencimentos.mockResolvedValue({
      dias: 30,
      vencidas: [linha("Ana", -5)],
      vencendo: [],
    });

    render(<VencimentosCard />);

    expect(await screen.findByText("venceu há 5 dias")).toBeInTheDocument();
    expect(screen.queryByText(/vence em -/)).not.toBeInTheDocument();
  });

  it("singular e plural, e o caso de HOJE", async () => {
    listarVencimentos.mockResolvedValue({
      dias: 30,
      vencidas: [linha("Ana", -1)],
      vencendo: [linha("Bruno", 0), linha("Carla", 1)],
    });

    render(<VencimentosCard />);

    // "venceu há 1 dias" e "vence em 0 dias" são as duas frases que a tela
    // produziria sem cuidado, e as duas são visíveis para o gestor.
    expect(await screen.findByText("venceu há 1 dia")).toBeInTheDocument();
    expect(screen.getByText("vence hoje")).toBeInTheDocument();
    expect(screen.getByText("vence em 1 dia")).toBeInTheDocument();
  });

  it("cada linha leva à ficha do aluno (AC-012)", async () => {
    listarVencimentos.mockResolvedValue({
      dias: 30,
      vencidas: [],
      vencendo: [linha("Ana", 3)],
    });

    render(<VencimentosCard />);

    const link = await screen.findByRole("link", { name: "Ana" });
    // A lista NÃO matricula: matricular exige escolher plano e valor, e um
    // botão aqui esconderia a escolha.
    expect(link).toHaveAttribute("href", "/pessoas/alunos/id-Ana");
  });

  it("trocar a janela refaz a consulta com o novo valor", async () => {
    render(<VencimentosCard />);
    await waitFor(() => expect(listarVencimentos).toHaveBeenCalledWith(30));

    fireEvent.click(screen.getByText("7 dias"));

    await waitFor(() => expect(listarVencimentos).toHaveBeenCalledWith(7));
  });

  it("lista vazia diz que está tudo em dia, e não some da tela", async () => {
    render(<VencimentosCard />);

    // Card que não renderiza nada quando não há pendência faz o gestor
    // duvidar se carregou. Zero é uma resposta, e precisa ser dita.
    expect(
      await screen.findByText(/Ninguém vencendo nos próximos 30 dias/i),
    ).toBeInTheDocument();
  });

  it("erro do servidor aparece com a mensagem dele", async () => {
    listarVencimentos.mockRejectedValue(
      new ApiError(500, "O banco não respondeu."),
    );

    render(<VencimentosCard />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "O banco não respondeu.",
    );
  });

  it("**o grupo vazio não desenha cabeçalho**", async () => {
    listarVencimentos.mockResolvedValue({
      dias: 30,
      vencidas: [],
      vencendo: [linha("Carla", 3)],
    });

    render(<VencimentosCard />);

    await screen.findByText("Vencendo (1)");
    // "Vencidas (0)" ocuparia espaço para dizer que não há nada — e num painel
    // que o gestor abre todo dia, ruído vira paisagem.
    expect(screen.queryByText(/Vencidas/)).not.toBeInTheDocument();
  });
});
