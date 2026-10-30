import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api-client";
import {
  CONFIRMACAO_AO_LIGAR,
  RestricaoDeNivelCard,
} from "./restricao-de-nivel-card";

/**
 * SPEC-093 — o interruptor da restrição de nível na tela de Níveis.
 *
 * - AC-005: a tela mostra o valor atual ao abrir, com o texto do efeito nos
 *   dois estados.
 * - AC-006: ligar pede a confirmação da D6, e cancelar não manda nada;
 *   desligar troca direto.
 */

const getMinhaEmpresa = vi.hoisted(() => vi.fn());
const definirRestricaoDeNivel = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api-client", async () => {
  const real =
    await vi.importActual<typeof import("@/lib/api-client")>(
      "@/lib/api-client",
    );
  return { ...real, getMinhaEmpresa, definirRestricaoDeNivel };
});

function empresa(nivelRestringeAcesso: boolean) {
  return {
    id: "e1",
    nome: "Smart Tennis",
    slug: "smart-tennis",
    status: "ativa",
    permiteAutoCadastro: true,
    limiteTurmasPorAluno: null,
    nivelRestringeAcesso,
    logoUrl: null,
  };
}

const confirmar = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("confirm", confirmar);
  definirRestricaoDeNivel.mockImplementation((v: boolean) =>
    Promise.resolve(empresa(v)),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("AC-005 — o valor atual e o efeito, nos dois estados", () => {
  it("desligada", async () => {
    getMinhaEmpresa.mockResolvedValue(empresa(false));
    render(<RestricaoDeNivelCard />);

    expect(await screen.findByText("Desligada")).toBeInTheDocument();
    expect(
      screen.getByText(
        "O nível é só um rótulo: qualquer aluno entra em qualquer turma.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ligar" })).toBeInTheDocument();
  });

  it("ligada", async () => {
    getMinhaEmpresa.mockResolvedValue(empresa(true));
    render(<RestricaoDeNivelCard />);

    expect(await screen.findByText("Ligada")).toBeInTheDocument();
    expect(
      screen.getByText("Cada aluno só entra nas turmas do seu nível."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Desligar" }),
    ).toBeInTheDocument();
  });

  it("erro ao carregar aparece, e não há botão", async () => {
    getMinhaEmpresa.mockRejectedValue(new ApiError(500, "Falhou o servidor."));
    render(<RestricaoDeNivelCard />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Falhou o servidor.",
    );
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});

describe("AC-006 — ligar confirma, desligar não", () => {
  it("ligar mostra a frase da D6 e, confirmado, manda `true`", async () => {
    confirmar.mockReturnValue(true);
    getMinhaEmpresa.mockResolvedValue(empresa(false));
    render(<RestricaoDeNivelCard />);

    fireEvent.click(await screen.findByRole("button", { name: "Ligar" }));

    expect(confirmar).toHaveBeenCalledTimes(1);
    expect(confirmar.mock.calls[0][0]).toContain(CONFIRMACAO_AO_LIGAR);
    expect(CONFIRMACAO_AO_LIGAR).toBe(
      "Alunos fora do nível continuam nas turmas atuais, mas não entram em turmas novas de outro nível.",
    );
    await waitFor(() =>
      expect(definirRestricaoDeNivel).toHaveBeenCalledWith(true),
    );
    expect(await screen.findByText("Ligada")).toBeInTheDocument();
  });

  it("cancelar a confirmação não manda nada e não muda a tela", async () => {
    confirmar.mockReturnValue(false);
    getMinhaEmpresa.mockResolvedValue(empresa(false));
    render(<RestricaoDeNivelCard />);

    fireEvent.click(await screen.findByRole("button", { name: "Ligar" }));

    expect(confirmar).toHaveBeenCalledTimes(1);
    expect(definirRestricaoDeNivel).not.toHaveBeenCalled();
    expect(screen.getByText("Desligada")).toBeInTheDocument();
  });

  it("desligar troca direto, sem confirmação, e manda `false`", async () => {
    getMinhaEmpresa.mockResolvedValue(empresa(true));
    render(<RestricaoDeNivelCard />);

    fireEvent.click(await screen.findByRole("button", { name: "Desligar" }));

    await waitFor(() =>
      expect(definirRestricaoDeNivel).toHaveBeenCalledWith(false),
    );
    expect(confirmar).not.toHaveBeenCalled();
    expect(await screen.findByText("Desligada")).toBeInTheDocument();
  });

  it("recusa do servidor aparece e o estado fica como estava", async () => {
    definirRestricaoDeNivel.mockRejectedValue(
      new ApiError(403, "Sem permissão."),
    );
    getMinhaEmpresa.mockResolvedValue(empresa(true));
    render(<RestricaoDeNivelCard />);

    fireEvent.click(await screen.findByRole("button", { name: "Desligar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Sem permissão.",
    );
    expect(screen.getByText("Ligada")).toBeInTheDocument();
  });
});
