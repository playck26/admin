import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { DashboardSummary } from "@/lib/api-client";
import { DashboardSummaryView } from "./dashboard-summary";

/**
 * SPEC-052/AC-011 — **o painel sem o Acesso rápido.**
 *
 * O bloco repetia o menu lateral item por item (Alunos, Professores, Níveis,
 * Quadras, Turmas, Pagamento) e não tinha teste nenhum: removê-lo não
 * derrubaria nada, e por isso mesmo a remoção precisa de prova própria —
 * senão ele volta num merge e ninguém nota.
 *
 * A segunda metade é o que NÃO pode sair junto: o `EvasaoCard`, que o
 * comentário do componente posicionava "acima do acesso rápido". É a única
 * coisa da tela que pede ação; sumir com ela por arrastar o vizinho seria o
 * defeito que esta prova existe para impedir.
 */

const RESUMO: DashboardSummary = {
  alunosAtivos: 87,
  ocupacaoTurmasPct: 72,
  ocupacaoQuadrasPct: 45,
};

vi.mock("@/lib/api-client", async (original) => ({
  ...(await original<typeof import("@/lib/api-client")>()),
  getDashboardSummary: vi.fn(() => Promise.resolve(RESUMO)),
}));

/** O cartão de evasão busca dados próprios — aqui só importa que ele esteja na tela. */
vi.mock("@/components/evasao-card", () => ({
  EvasaoCard: () => <section aria-label="Alunos em risco de evasão" />,
}));

describe("DashboardSummaryView — SPEC-052/AC-011", () => {
  it("não renderiza o Acesso rápido nem seus atalhos", async () => {
    render(<DashboardSummaryView />);
    await waitFor(() => expect(screen.getByText("87")).toBeInTheDocument());

    expect(screen.queryByText("Acesso rápido")).not.toBeInTheDocument();
    expect(screen.queryByText("Operação diária")).not.toBeInTheDocument();
    // Os atalhos, e não só o título: um bloco sem cabeçalho ainda seria o bloco.
    expect(screen.queryByRole("link", { name: /Pagamento/ })).not.toBeInTheDocument();
  });

  it("mantém o cartão de evasão", async () => {
    render(<DashboardSummaryView />);
    await waitFor(() => expect(screen.getByText("87")).toBeInTheDocument());

    expect(
      screen.getByRole("region", { name: "Alunos em risco de evasão" }),
    ).toBeInTheDocument();
  });
});
