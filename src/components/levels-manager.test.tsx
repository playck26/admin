import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, type Level } from "@/lib/api-client";
import { LevelsManager, primeiroNivel } from "./levels-manager";

/**
 * SPEC-075/D8 — **a tela de níveis ganha a edição e a frase do primeiro.**
 *
 * - AC-018: editar o nome e a ordem manda `PATCH /levels/:id` com os DOIS
 *   campos e redesenha a lista; a recusa do servidor aparece na tela — inclusive
 *   a da D12 (a reordenação que deixaria aluno sem nível fora do nível da turma).
 * - AC-019: a tela diz que **o primeiro da ordem vale para quem ainda não foi
 *   classificado**, e diz qual é, pelo nome — com o mesmo desempate do servidor.
 */

const listLevels = vi.hoisted(() => vi.fn());
const updateLevel = vi.hoisted(() => vi.fn());
const createLevel = vi.hoisted(() => vi.fn());
const deleteLevel = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api-client", async () => {
  const real = await vi.importActual<typeof import("@/lib/api-client")>("@/lib/api-client");
  return { ...real, listLevels, updateLevel, createLevel, deleteLevel };
});

function nivel(id: string, nome: string, ordem: number, createdAt = "2026-01-01T10:00:00.000Z"): Level {
  return { id, companyId: "c1", nome, ordem, createdAt } as Level;
}

const INI = nivel("n1", "Iniciante", 1);
const INT = nivel("n2", "Intermediário", 2);
const AVA = nivel("n3", "Avançado", 3);

beforeEach(() => {
  for (const f of [listLevels, updateLevel, createLevel, deleteLevel]) f.mockReset();
  listLevels.mockResolvedValue([INI, INT, AVA]);
});

describe("primeiroNivel — o mesmo desempate do servidor (SPEC-075/D1)", () => {
  it("menor ordem", () => {
    expect(primeiroNivel([INT, AVA, INI])?.id).toBe("n1");
  });

  it("ordem empatada: menor createdAt", () => {
    const antigo = nivel("z9", "Antigo", 1, "2026-01-01T09:00:00.000Z");
    const novo = nivel("a1", "Novo", 1, "2026-01-02T09:00:00.000Z");
    expect(primeiroNivel([novo, antigo])?.id).toBe("z9");
  });

  it("ordem e createdAt empatados: menor id", () => {
    const maior = nivel("z9", "Maior", 1);
    const menor = nivel("a1", "Menor", 1);
    expect(primeiroNivel([maior, menor])?.id).toBe("a1");
  });

  it("sem nível nenhum: nenhum", () => {
    expect(primeiroNivel([])).toBeNull();
  });
});

describe("LevelsManager — SPEC-075/D8", () => {
  it("AC-019: a frase diz que o primeiro vale para quem ainda não foi classificado, e diz qual", async () => {
    render(<LevelsManager />);
    const frase = await screen.findByText(/vale\s+para quem ainda não foi classificado/);
    expect(frase).toHaveTextContent(
      "O primeiro da ordem, Iniciante, vale para quem ainda não foi classificado: o aluno sem nível conta como Iniciante, e só entra nas turmas desse nível ou nas que não têm nível.",
    );
  });

  it("AC-019: sem nível nenhum, não há frase", async () => {
    listLevels.mockResolvedValue([]);
    render(<LevelsManager />);
    await screen.findByText("Nenhum nível cadastrado ainda.");
    expect(screen.queryByText(/não foi classificado/)).not.toBeInTheDocument();
  });

  it("AC-018: editar nome e ordem manda PATCH com os DOIS campos e redesenha a lista", async () => {
    updateLevel.mockResolvedValue({ ...INI, nome: "Bronze", ordem: 5 });
    render(<LevelsManager />);
    const linha = (await screen.findByRole("cell", { name: "Iniciante" })).closest("tr") as HTMLElement;
    fireEvent.click(within(linha).getByRole("button", { name: "Editar" }));

    fireEvent.change(screen.getByLabelText("Nome de Iniciante"), { target: { value: "Bronze" } });
    fireEvent.change(screen.getByLabelText("Ordem de Iniciante"), { target: { value: "5" } });
    listLevels.mockResolvedValue([INT, AVA, { ...INI, nome: "Bronze", ordem: 5 }]);
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => expect(updateLevel).toHaveBeenCalledWith("n1", { nome: "Bronze", ordem: 5 }));
    expect(await screen.findByText("Bronze")).toBeInTheDocument();
    // A lista foi relida (e a frase acompanhou: o primeiro agora é o Intermediário).
    expect(listLevels).toHaveBeenCalledTimes(2);
    expect(await screen.findByText(/vale\s+para quem ainda não foi classificado/)).toHaveTextContent(
      "O primeiro da ordem, Intermediário,",
    );
  });

  it("AC-018: a recusa do servidor aparece na tela — a da D12, inteira", async () => {
    const mensagem =
      "Isso faria o primeiro nível deixar de ser Iniciante, e 1 aluno sem nível está em turma de Iniciante. Defina o nível dele antes.";
    updateLevel.mockRejectedValue(new ApiError(422, mensagem));
    render(<LevelsManager />);
    const linha = (await screen.findByRole("cell", { name: "Intermediário" })).closest("tr") as HTMLElement;
    fireEvent.click(within(linha).getByRole("button", { name: "Editar" }));
    fireEvent.change(screen.getByLabelText("Ordem de Intermediário"), { target: { value: "0" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(mensagem);
    // Continua em edição: o gestor corrige, ou cancela.
    expect(screen.getByLabelText("Ordem de Intermediário")).toBeInTheDocument();
  });

  it("AC-018: a recusa de nome repetido também aparece", async () => {
    updateLevel.mockRejectedValue(new ApiError(409, "Já existe um nível com esse nome (AC-003)"));
    render(<LevelsManager />);
    const linha = (await screen.findByRole("cell", { name: "Avançado" })).closest("tr") as HTMLElement;
    fireEvent.click(within(linha).getByRole("button", { name: "Editar" }));
    fireEvent.change(screen.getByLabelText("Nome de Avançado"), { target: { value: "Iniciante" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Já existe um nível com esse nome");
  });

  it("Cancelar volta a linha sem chamar o servidor", async () => {
    render(<LevelsManager />);
    const linha = (await screen.findByRole("cell", { name: "Iniciante" })).closest("tr") as HTMLElement;
    fireEvent.click(within(linha).getByRole("button", { name: "Editar" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByLabelText("Nome de Iniciante")).not.toBeInTheDocument();
    expect(updateLevel).not.toHaveBeenCalled();
  });
});
