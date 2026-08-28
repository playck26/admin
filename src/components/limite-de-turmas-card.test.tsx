import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LimiteDeTurmasCard } from "./limite-de-turmas-card";

/**
 * SPEC-023 — as provas do limite de turmas por aluno.
 *
 * O que elas guardam são as duas decisões que a tela poderia trair sem
 * ninguém notar: **vazio é "sem limite"** (e precisa dar para voltar a ele),
 * e **o limite não expulsa ninguém** — o gestor tem de ler isso antes de
 * salvar, senão espera que o sistema tire gente das turmas e depois descobre
 * que não tirou.
 */

const getMinhaEmpresa = vi.hoisted(() => vi.fn());
const definirLimiteDeTurmas = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api-client", async () => {
  const real =
    await vi.importActual<typeof import("@/lib/api-client")>(
      "@/lib/api-client",
    );
  return { ...real, getMinhaEmpresa, definirLimiteDeTurmas };
});

function empresa(limiteTurmasPorAluno: number | null) {
  return {
    id: "e1",
    nome: "Smart Tennis",
    slug: "smart-tennis",
    status: "ativa",
    permiteAutoCadastro: true,
    limiteTurmasPorAluno,
    logoUrl: null,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  definirLimiteDeTurmas.mockImplementation((v: number | null) =>
    Promise.resolve(empresa(v)),
  );
});

describe("vazio é sem limite, e é o padrão", () => {
  it("empresa sem limite mostra o campo vazio", async () => {
    getMinhaEmpresa.mockResolvedValue(empresa(null));
    render(<LimiteDeTurmasCard />);

    const campo = await screen.findByLabelText("Limite de turmas por aluno");
    expect(campo).toHaveValue(null);
    expect(campo).toHaveAttribute("placeholder", "Sem limite");
  });

  it("apagar o número volta a não limitar", async () => {
    // Precisa dar para VOLTAR ao padrão depois de alguém ter posto um
    // número. Sem isso, ligar o limite seria irreversível pela tela.
    getMinhaEmpresa.mockResolvedValue(empresa(3));
    render(<LimiteDeTurmasCard />);

    const campo = await screen.findByLabelText("Limite de turmas por aluno");
    fireEvent.change(campo, { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() =>
      expect(definirLimiteDeTurmas).toHaveBeenCalledWith(null),
    );
  });

  it("salva o número quando há um", async () => {
    getMinhaEmpresa.mockResolvedValue(empresa(null));
    render(<LimiteDeTurmasCard />);

    fireEvent.change(await screen.findByLabelText("Limite de turmas por aluno"), {
      target: { value: "2" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => expect(definirLimiteDeTurmas).toHaveBeenCalledWith(2));
  });
});

describe("zero não é limite, é desligar", () => {
  it("recusa 0 sem chamar a API", async () => {
    getMinhaEmpresa.mockResolvedValue(empresa(null));
    render(<LimiteDeTurmasCard />);

    fireEvent.change(await screen.findByLabelText("Limite de turmas por aluno"), {
      target: { value: "0" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "O limite começa em 1",
    );
    expect(definirLimiteDeTurmas).not.toHaveBeenCalled();
  });

  it("recusa negativo", async () => {
    getMinhaEmpresa.mockResolvedValue(empresa(null));
    render(<LimiteDeTurmasCard />);

    fireEvent.change(await screen.findByLabelText("Limite de turmas por aluno"), {
      target: { value: "-1" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(definirLimiteDeTurmas).not.toHaveBeenCalled();
  });
});

describe("o gestor precisa saber o que NÃO acontece", () => {
  it("a tela diz que o limite não expulsa ninguém (INV-023a)", async () => {
    getMinhaEmpresa.mockResolvedValue(empresa(2));
    render(<LimiteDeTurmasCard />);

    expect(
      await screen.findByText(/continuam nelas/i),
    ).toBeInTheDocument();
  });
});
