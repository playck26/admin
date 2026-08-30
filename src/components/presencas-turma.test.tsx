import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PresencasTurma } from "./presencas-turma";

/**
 * TEST (SPEC-030:TASK-007) — o histórico de presença, do lado do gestor.
 *
 * **Esta tela não tinha teste nenhum até aqui**, e a SPEC-030 lhe deu a
 * primeira ação de escrita — até então era só leitura (LIM-002).
 *
 * O que estas provas guardam é o motivo de a spec existir: a aula que
 * ninguém respondeu **não aparecia nesta tela**, porque ela sempre filtrou
 * por `chamadaFeita`. Enquanto o professor está no clube isso é coerente
 * (quem lança é ele); quando ele sai, ninguém mais tem caminho, e o dia fica
 * vermelho para sempre no calendário.
 */

const listPresencasDaTurma = vi.hoisted(() => vi.fn());
const registrarNaoHouveAula = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api-client", async () => {
  const real =
    await vi.importActual<typeof import("@/lib/api-client")>(
      "@/lib/api-client",
    );
  return { ...real, listPresencasDaTurma, registrarNaoHouveAula };
});

function ocorrencia(patch: Record<string, unknown> = {}) {
  return {
    ocupacaoId: "oc1",
    data: "2026-08-25",
    horaInicio: "18:00",
    horaFim: "19:00",
    cancelada: false,
    chamadaFeita: false,
    estado: "pendente",
    registradoPor: null,
    alunos: [],
    ...patch,
  };
}

const COM_CHAMADA = ocorrencia({
  ocupacaoId: "oc-feita",
  data: "2026-08-24",
  chamadaFeita: true,
  estado: "feita",
  registradoPor: "Carlos Lima",
  alunos: [
    { alunoId: "a1", nome: "Ana", status: "presente", naTurmaHoje: true, alunoAtivo: true },
    { alunoId: "a2", nome: "Bruno", status: "ausente", naTurmaHoje: true, alunoAtivo: true },
  ],
});

beforeEach(() => {
  listPresencasDaTurma.mockReset();
  registrarNaoHouveAula.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("PresencasTurma — aulas sem chamada (SPEC-030)", () => {
  it("mostra a aula pendente, que antes era invisível para o gestor", async () => {
    listPresencasDaTurma.mockResolvedValue([ocorrencia()]);

    render(<PresencasTurma turmaId="t1" />);

    expect(await screen.findByText("Aulas sem chamada (1)")).toBeInTheDocument();
    expect(screen.getByText("25/08/2026")).toBeInTheDocument();
  });

  // O caminho normal continua sendo o professor lançar a chamada. A tela diz
  // isso ANTES de oferecer a saída — senão o gestor passa a fechar aula por
  // atalho, e o registro do clube fica pior, não melhor.
  it("diz de quem é a ação antes de oferecer o botão", async () => {
    listPresencasDaTurma.mockResolvedValue([ocorrencia()]);

    render(<PresencasTurma turmaId="t1" />);

    expect(
      await screen.findByText(/Quem lança a chamada é o professor/),
    ).toBeInTheDocument();
  });

  it("não oferece a ação em aula futura, em andamento ou cancelada", async () => {
    listPresencasDaTurma.mockResolvedValue([
      ocorrencia({ ocupacaoId: "f", estado: "futura" }),
      ocorrencia({ ocupacaoId: "a", estado: "em_andamento" }),
      ocorrencia({ ocupacaoId: "c", estado: "cancelada", cancelada: true }),
    ]);

    render(<PresencasTurma turmaId="t1" />);

    await waitFor(() => expect(listPresencasDaTurma).toHaveBeenCalled());
    expect(screen.queryByText(/Aulas sem chamada/)).not.toBeInTheDocument();
  });

  it("pede confirmação, e desistir não chama a API", async () => {
    listPresencasDaTurma.mockResolvedValue([ocorrencia()]);
    vi.stubGlobal(
      "confirm",
      vi.fn(() => false),
    );

    render(<PresencasTurma turmaId="t1" />);
    fireEvent.click(
      await screen.findByRole("button", { name: "A aula não aconteceu" }),
    );

    expect(registrarNaoHouveAula).not.toHaveBeenCalled();
  });

  it("registra com turmaId e ocupacaoId, e relê a lista depois", async () => {
    listPresencasDaTurma
      .mockResolvedValueOnce([ocorrencia()])
      .mockResolvedValueOnce([
        ocorrencia({ chamadaFeita: true, estado: "nao_houve" }),
      ]);
    registrarNaoHouveAula.mockResolvedValue({
      ocupacaoId: "oc1",
      completude: "nao_houve",
    });
    vi.stubGlobal(
      "confirm",
      vi.fn(() => true),
    );

    render(<PresencasTurma turmaId="t1" />);
    fireEvent.click(
      await screen.findByRole("button", { name: "A aula não aconteceu" }),
    );

    await waitFor(() =>
      expect(registrarNaoHouveAula).toHaveBeenCalledWith("t1", "oc1"),
    );
    // Relê a lista inteira: a ocorrência MUDA DE GRUPO — sai de "sem
    // chamada" e entra em "Presenças". Remendar a linha localmente exigiria
    // reproduzir a regra de agrupamento que o servidor já resolveu.
    await waitFor(() =>
      expect(listPresencasDaTurma).toHaveBeenCalledTimes(2),
    );
    await waitFor(() =>
      expect(screen.queryByText(/Aulas sem chamada/)).not.toBeInTheDocument(),
    );
  });

  it("erro da API vira aviso, e a aula continua na lista", async () => {
    listPresencasDaTurma.mockResolvedValue([ocorrencia()]);
    registrarNaoHouveAula.mockRejectedValue(new Error("rede"));
    vi.stubGlobal(
      "confirm",
      vi.fn(() => true),
    );

    render(<PresencasTurma turmaId="t1" />);
    fireEvent.click(
      await screen.findByRole("button", { name: "A aula não aconteceu" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /não foi possível registrar/i,
    );
    expect(screen.getByText("Aulas sem chamada (1)")).toBeInTheDocument();
  });
});

describe("PresencasTurma — a aula não realizada na lista de baixo", () => {
  // `chamadaFeita` passou a incluir `nao_houve`, e ela tem ZERO presenças.
  // Sem tratar o estado, a linha diria "0/0 presentes" — que sugere uma
  // chamada lançada vazia pelo professor, o oposto do que aconteceu.
  it("diz 'aula não realizada' e 'sem chamada', nunca '0/0 presentes'", async () => {
    listPresencasDaTurma.mockResolvedValue([
      ocorrencia({ chamadaFeita: true, estado: "nao_houve", alunos: [] }),
    ]);

    render(<PresencasTurma turmaId="t1" />);

    expect(await screen.findByText("aula não realizada")).toBeInTheDocument();
    expect(screen.getByText("sem chamada")).toBeInTheDocument();
    expect(screen.queryByText("0/0 presentes")).not.toBeInTheDocument();
  });

  it("a chamada de verdade continua mostrando a contagem", async () => {
    listPresencasDaTurma.mockResolvedValue([COM_CHAMADA]);

    render(<PresencasTurma turmaId="t1" />);

    expect(await screen.findByText("1/2 presentes")).toBeInTheDocument();
  });
});
