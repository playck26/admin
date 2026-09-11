import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api-client";
import { ClassManager } from "./class-manager";

/**
 * SPEC-035 — **o botão de status, que até 2026-09-09 não fazia nada.**
 *
 * O back gravava a coluna e parava aí: inativar a turma deixava a quadra
 * bloqueada para sempre, apontando para uma turma fora de operação. Agora
 * inativar cancela as ocupações futuras e reativar **regenera a grade** — e a
 * regeneração pode ser recusada, porque alguém pode ter reservado o horário
 * enquanto a turma estava desligada.
 *
 * **É essa recusa que este arquivo guarda.** O `409` traz `conflicts[]` com
 * TODOS os conflitos (`registerClassOccupancy` devolve todos de propósito), e
 * a mensagem crua do servidor — *"Conflito de horário com ocupação existente
 * na quadra"* — não diz nem quantos. Sem a tradução aqui, o gestor não sabe
 * se libera uma quadra ou seis.
 */
const getClass = vi.hoisted(() => vi.fn());
const updateClass = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api-client", async () => {
  const real =
    await vi.importActual<typeof import("@/lib/api-client")>(
      "@/lib/api-client",
    );
  return {
    ...real,
    getClass,
    updateClass,
    listCourts: vi.fn().mockResolvedValue({ data: [], total: 0 }),
    listLevels: vi.fn().mockResolvedValue([]),
    listTeachers: vi.fn().mockResolvedValue({ data: [], total: 0 }),
    listStudents: vi.fn().mockResolvedValue({ data: [], total: 0 }),
    listarAulasCanceladas: vi.fn().mockResolvedValue([]),
  };
});

/** As abas de chamada não têm nada a ver com o status — fora do caminho. */
vi.mock("@/components/turma-chamada-abas", () => ({
  TurmaChamadaAbas: () => null,
}));

function turma(status: "ativa" | "inativa") {
  return {
    id: "t-1",
    nome: "Turma A",
    quadraId: "q-1",
    quadraNome: "Quadra 1",
    nivelId: null,
    professorId: null,
    capacidade: 10,
    status,
    encontros: [{ diaSemana: 4, horaInicio: "18:00", horaFim: "19:00" }],
    alunos: [],
    totalAlunos: 0,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  updateClass.mockResolvedValue(undefined);
});

describe("ClassManager — inativar e reativar", () => {
  it("turma ativa oferece INATIVAR, e manda `status: inativa`", async () => {
    getClass.mockResolvedValue(turma("ativa"));
    render(<ClassManager id="t-1" />);

    fireEvent.click(await screen.findByText("Inativar turma"));

    await waitFor(() =>
      expect(updateClass).toHaveBeenCalledWith("t-1", { status: "inativa" }),
    );
  });

  it("turma inativa oferece REATIVAR, e manda `status: ativa`", async () => {
    getClass.mockResolvedValue(turma("inativa"));
    render(<ClassManager id="t-1" />);

    fireEvent.click(await screen.findByText("Reativar turma"));

    await waitFor(() =>
      expect(updateClass).toHaveBeenCalledWith("t-1", { status: "ativa" }),
    );
  });

  it("um conflito: a mensagem diz UM horário, e o que fazer", async () => {
    getClass.mockResolvedValue(turma("inativa"));
    updateClass.mockRejectedValue(
      new ApiError(
        409,
        "Conflito de horário com ocupação existente",
        undefined,
        undefined,
        [{ ocupacaoId: "o-1", origemTipo: "AVULSO" }],
      ),
    );
    render(<ClassManager id="t-1" />);

    fireEvent.click(await screen.findByText("Reativar turma"));

    expect(
      await screen.findByText(/um horário da turma já foi ocupado/),
    ).toBeInTheDocument();
    // A mensagem tem de dizer a SAÍDA, não só o problema: sem isto o gestor
    // fica olhando para uma recusa sem próximo passo.
    expect(
      screen.getByText(/Libere a quadra ou mude a recorrência/),
    ).toBeInTheDocument();
  });

  it("três conflitos: a mensagem diz TRÊS, e não repete a do singular", async () => {
    getClass.mockResolvedValue(turma("inativa"));
    updateClass.mockRejectedValue(
      new ApiError(409, "Conflito", undefined, undefined, [
        { ocupacaoId: "o-1", origemTipo: "AVULSO" },
        { ocupacaoId: "o-2", origemTipo: "TURMA" },
        { ocupacaoId: "o-3", origemTipo: "AVULSO" },
      ]),
    );
    render(<ClassManager id="t-1" />);

    fireEvent.click(await screen.findByText("Reativar turma"));

    // **A contagem é o que a mensagem do servidor não dá.** Saber se é um
    // horário ou seis muda o que o gestor faz a seguir.
    expect(
      await screen.findByText(/3 horários da turma já foram ocupados/),
    ).toBeInTheDocument();
  });

  it("erro SEM `conflicts` cai na mensagem do servidor, e não inventa contagem", async () => {
    getClass.mockResolvedValue(turma("inativa"));
    updateClass.mockRejectedValue(
      new ApiError(422, "A turma cai fora do horário de funcionamento."),
    );
    render(<ClassManager id="t-1" />);

    fireEvent.click(await screen.findByText("Reativar turma"));

    // O `422 FORA_DO_EXPEDIENTE` acontece quando o horário da quadra mudou
    // enquanto a turma estava inativa — outra causa, outra saída.
    expect(
      await screen.findByText(/fora do horário de funcionamento/),
    ).toBeInTheDocument();
  });
});
