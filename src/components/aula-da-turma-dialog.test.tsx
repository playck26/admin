import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, type ItemDoDia } from "@/lib/api-client";
import { AulaDaTurmaDialog } from "./aula-da-turma-dialog";

/**
 * SPEC-057/TASK-005/D17 e D18 (card 5349) — **o gestor opera a aula pela
 * agenda**: vê quem está matriculado e quem vem repor, tira e põe aluno.
 *
 * O diálogo reusa os endpoints de matrícula que já existem (D18). O que se
 * prova aqui é o comportamento da TELA sobre eles:
 *
 * - "Matrículas X/Y" e "Ocupação desta aula X/Y" são duas coisas, e aparecem
 *   separadas — vaga de reposição não é vaga de matrícula;
 * - visitante é identificado como reposição, e retirar matrícula não o tira;
 * - `409` de aula iniciada **não fecha o diálogo nem some com a linha** —
 *   remover de forma otimista mostraria uma saída que não aconteceu;
 * - `409` de capacidade explica a diferença entre as duas vagas e recarrega
 *   as contagens;
 * - sucesso recarrega o detalhe e avisa a agenda.
 */

const api = vi.hoisted(() => ({
  getClass: vi.fn(),
  getVisitantesDaOcorrencia: vi.fn(),
  getAgendaDia: vi.fn(),
  allocateStudentInClass: vi.fn(),
  removeStudentFromClass: vi.fn(),
  listStudents: vi.fn(),
}));

vi.mock("@/lib/api-client", async () => {
  const real =
    await vi.importActual<typeof import("@/lib/api-client")>("@/lib/api-client");
  return { ...real, ...api };
});

afterEach(cleanup);

const TURMA = "11111111-1111-4111-8111-11111111111a";
const AULA = "11111111-1111-4111-8111-1111111111c1";

function aula(over: Partial<ItemDoDia> = {}): ItemDoDia {
  return {
    id: AULA,
    quadraId: "11111111-1111-4111-8111-111111111111",
    quadraNome: "Quadra 1",
    quadraCor: "#00763A",
    quadraCodigoAgenda: "3",
    horaInicio: "19:00",
    horaFim: "20:00",
    origemTipo: "TURMA",
    origemTurmaId: TURMA,
    tipoVisual: "TURMA",
    responsavel: "Turma das 19h",
    statusPagamento: "pendente_pagamento",
    valor: null,
    criadaPor: null,
    canceladaPor: null,
    adicionais: [],
    capacidade: 3,
    matriculados: 2,
    faltasAvisadas: 1,
    reposicoesMarcadas: 2,
    reposicoesNaOcupacao: 2,
    ocupados: 3,
    vagasNaOcorrencia: 0,
    ...over,
  };
}

function detalhe(alunos: { alunoId: string; nome: string }[]) {
  return {
    id: TURMA,
    nome: "Turma das 19h",
    capacidade: 3,
    alunos: alunos.map((a) => ({ ...a, email: `${a.nome}@x.com` })),
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  api.getClass.mockResolvedValue(
    detalhe([
      { alunoId: "a-1", nome: "Bruno" },
      { alunoId: "a-2", nome: "Carla" },
    ]),
  );
  api.getVisitantesDaOcorrencia.mockResolvedValue([
    { alunoId: "v-1", nome: "Diego", nivelId: null, nivelNome: "Iniciante", tipo: "reposicao" },
  ]);
  api.getAgendaDia.mockResolvedValue([aula()]);
  api.listStudents.mockResolvedValue({ data: [{ id: "n-1", nome: "Novo Aluno" }], total: 1 });
});

function abrir(onMudou = vi.fn(), onFechar = vi.fn()) {
  render(
    <AulaDaTurmaDialog
      item={aula()}
      data="2035-06-07"
      onFechar={onFechar}
      onMudou={onMudou}
    />,
  );
  return { onMudou, onFechar };
}

describe("AulaDaTurmaDialog (D17/D18)", () => {
  it("mostra matrículas e ocupação desta aula SEPARADAS, com as reposições", async () => {
    abrir();

    expect(await screen.findByText("Matrículas 2/3")).toBeInTheDocument();
    expect(screen.getByText("Ocupação desta aula 3/3")).toBeInTheDocument();
    expect(screen.getByText("Reposições marcadas 2")).toBeInTheDocument();
    expect(api.getAgendaDia).toHaveBeenCalledWith("2035-06-07");
  });

  it("lista matriculados e visitantes; o visitante é identificado como reposição", async () => {
    abrir();

    const matriculados = await screen.findByRole("list", { name: "Matriculados" });
    expect(within(matriculados).getByText("Bruno")).toBeInTheDocument();
    expect(within(matriculados).getByText("Carla")).toBeInTheDocument();

    const visitantes = screen.getByRole("list", { name: "Visitantes desta aula" });
    expect(within(visitantes).getByText("Diego")).toBeInTheDocument();
    expect(within(visitantes).getByText("Reposição")).toBeInTheDocument();
    expect(within(visitantes).getByText("Iniciante")).toBeInTheDocument();
    // Visitante não tem botão de remover matrícula: ele não é matriculado.
    expect(within(visitantes).queryByRole("button")).toBeNull();
    // E a tela não mostra contato de ninguém.
    expect(screen.queryByText(/@x\.com/)).toBeNull();
  });

  it("409 de aula iniciada: mensagem do servidor, diálogo aberto, linha continua", async () => {
    const { onFechar, onMudou } = abrir();
    api.removeStudentFromClass.mockRejectedValue(
      new ApiError(409, "Esta aula já começou. Remover o aluno agora não desfaz a presença dele.", undefined, "PRAZO_DE_CANCELAMENTO"),
    );

    fireEvent.click(await screen.findByRole("button", { name: "Remover Bruno da turma" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Esta aula já começou");
    expect(screen.getByText("Bruno")).toBeInTheDocument();
    expect(onFechar).not.toHaveBeenCalled();
    expect(onMudou).not.toHaveBeenCalled();
  });

  it("409 de capacidade ao alocar: explica que vaga de reposição não é matrícula e recarrega as contagens", async () => {
    abrir();
    api.allocateStudentInClass.mockRejectedValue(
      new ApiError(409, "Capacidade da turma excedida (INV-003, AC-002)"),
    );

    await screen.findByRole("option", { name: "Novo Aluno" });
    fireEvent.change(screen.getByLabelText("Adicionar aluno"), {
      target: { value: "n-1" },
    });
    const chamadasAntes = api.getAgendaDia.mock.calls.length;
    fireEvent.click(screen.getByRole("button", { name: "Adicionar à turma" }));

    const alerta = await screen.findByRole("alert");
    expect(alerta).toHaveTextContent("A turma não tem vaga de matrícula");
    expect(alerta).toHaveTextContent("vaga de reposição, não de matrícula");
    await waitFor(() =>
      expect(api.getAgendaDia.mock.calls.length).toBeGreaterThan(chamadasAntes),
    );
  });

  it("sucesso ao remover: recarrega o detalhe e avisa a agenda", async () => {
    const { onMudou } = abrir();
    api.removeStudentFromClass.mockResolvedValue(undefined);

    fireEvent.click(await screen.findByRole("button", { name: "Remover Bruno da turma" }));

    await waitFor(() =>
      expect(api.removeStudentFromClass).toHaveBeenCalledWith(TURMA, "a-1"),
    );
    await waitFor(() => expect(onMudou).toHaveBeenCalledTimes(1));
    expect(api.getClass).toHaveBeenCalledTimes(2);
  });

  it("sucesso ao alocar: chama o endpoint existente e recarrega", async () => {
    const { onMudou } = abrir();
    api.allocateStudentInClass.mockResolvedValue(undefined);

    await screen.findByRole("option", { name: "Novo Aluno" });
    fireEvent.change(screen.getByLabelText("Adicionar aluno"), {
      target: { value: "n-1" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Adicionar à turma" }));

    await waitFor(() =>
      expect(api.allocateStudentInClass).toHaveBeenCalledWith(TURMA, "n-1"),
    );
    await waitFor(() => expect(onMudou).toHaveBeenCalledTimes(1));
  });

  it("AC-030: o diálogo da aula não oferece ação de reserva avulsa", async () => {
    abrir();

    await screen.findByText("Matrículas 2/3");
    expect(screen.queryByRole("button", { name: "Marcar pago" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Cancelar" })).toBeNull();
  });

  it("com `onCancelarAula`, oferece o cancelamento pela rota própria da SPEC-034", async () => {
    const onCancelarAula = vi.fn();
    render(
      <AulaDaTurmaDialog
        item={aula()}
        data="2035-06-07"
        onFechar={vi.fn()}
        onMudou={vi.fn()}
        onCancelarAula={onCancelarAula}
      />,
    );

    fireEvent.click(await screen.findByRole("button", { name: "Cancelar esta aula" }));
    expect(onCancelarAula).toHaveBeenCalledTimes(1);
  });
});
