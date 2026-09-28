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
const listLevels = vi.hoisted(() => vi.fn());

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
    listLevels,
    listTeachers: vi.fn().mockResolvedValue({ data: [], total: 0 }),
    listStudents: vi.fn().mockResolvedValue({ data: [], total: 0 }),
    listarAulasCanceladas: vi.fn().mockResolvedValue([]),
  };
});

/** As abas de chamada não têm nada a ver com o status — fora do caminho. */
vi.mock("@/components/turma-chamada-abas", () => ({
  TurmaChamadaAbas: () => null,
}));

const NIVEIS = [
  { id: "n-1", companyId: "c-1", nome: "Iniciante", ordem: 0, createdAt: "2026-01-01T00:00:00.000Z" },
  { id: "n-2", companyId: "c-1", nome: "Intermediário", ordem: 1, createdAt: "2026-01-01T00:00:00.000Z" },
];

function turma(status: "ativa" | "inativa") {
  return {
    id: "t-1",
    nome: "Turma A",
    quadraId: "q-1",
    quadraNome: "Quadra 1",
    // SPEC-079 — toda turma tem nível.
    nivelId: "n-2",
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
  listLevels.mockResolvedValue(NIVEIS);
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

/**
 * SPEC-079/AC-006 — **editar turma não oferece mais "Sem nível"** (decisão do
 * Israel de 2026-09-28: toda turma tem nível). O seletor mostra o nível da
 * turma, e salvar sem mexer nele manda o mesmo nível.
 *
 * O caso da turma antiga ainda sem nível só existe antes da passagem (a
 * migração A da SPEC-079 dá o primeiro nível a todas): a tela não inventa um
 * nível, e NÃO manda `nivelId` — sem o campo, o servidor não mexe no nível
 * (AC-004). Mandar `null` seria pedir para tirar o nível, e o Back recusa.
 */
describe("SPEC-079/AC-006 — editar turma: sem \"Sem nível\"", () => {
  it("o seletor mostra o nível da turma, e as opções são só os níveis do clube", async () => {
    getClass.mockResolvedValue(turma("ativa"));
    render(<ClassManager id="t-1" />);

    await waitFor(() =>
      expect(screen.getByLabelText("Nível")).toHaveTextContent("Intermediário"),
    );
    fireEvent.click(screen.getByLabelText("Nível"));

    const opcoes = await screen.findAllByRole("option");
    expect(opcoes.map((o) => o.textContent)).toEqual([
      "Iniciante",
      "Intermediário",
    ]);
    expect(screen.queryByText("Sem nível")).toBeNull();
  });

  it("salvar sem mexer no nível manda o nível da turma", async () => {
    getClass.mockResolvedValue(turma("ativa"));
    render(<ClassManager id="t-1" />);
    await waitFor(() =>
      expect(screen.getByLabelText("Nível")).toHaveTextContent("Intermediário"),
    );

    fireEvent.click(screen.getByRole("button", { name: /Salvar/ }));

    await waitFor(() => expect(updateClass).toHaveBeenCalledTimes(1));
    expect(updateClass.mock.calls[0][1]).toMatchObject({ nivelId: "n-2" });
  });

  it("turma antiga sem nível: não inventa nível e não manda `nivelId`", async () => {
    getClass.mockResolvedValue({ ...turma("ativa"), nivelId: null });
    render(<ClassManager id="t-1" />);
    await waitFor(() =>
      expect(screen.getByLabelText("Nível")).toHaveTextContent("Selecione um nível"),
    );

    fireEvent.click(screen.getByRole("button", { name: /Salvar/ }));

    await waitFor(() => expect(updateClass).toHaveBeenCalledTimes(1));
    const corpo = updateClass.mock.calls[0][1] as Record<string, unknown>;
    expect(corpo.nivelId).toBeUndefined();
  });
});
