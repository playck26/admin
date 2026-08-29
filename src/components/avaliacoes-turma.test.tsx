import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AvaliacoesTurma } from "./avaliacoes-turma";

/**
 * SPEC-025 — as provas da tela em que o gestor acha o detrator.
 *
 * O pedido do Israel foi *"identificar com facilidade os detratores"*. O que
 * estas provas guardam é justamente o que torna isso fácil, e que uma
 * refatoração distraída desfaria sem quebrar nada visível: **a ordem por
 * pior nota**, **a contagem antes da lista** e **a data da AULA em cada
 * linha**.
 */

const getAvaliacoesDaTurma = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api-client", async () => {
  const real =
    await vi.importActual<typeof import("@/lib/api-client")>(
      "@/lib/api-client",
    );
  return { ...real, getAvaliacoesDaTurma };
});

function item(patch: Record<string, unknown> = {}) {
  return {
    alunoNome: "Ana Souza",
    nota: 5,
    comentario: null,
    dataDaAula: "2026-08-12",
    horaInicio: "18:00",
    avaliadaEm: "2026-08-13T10:00:00.000Z",
    detrator: false,
    ...patch,
  };
}

beforeEach(() => vi.clearAllMocks());

describe("o resumo vem antes da lista", () => {
  it("conta os detratores, para o gestor saber se precisa ler", async () => {
    getAvaliacoesDaTurma.mockResolvedValue({
      itens: [
        item({ alunoNome: "Bruno", nota: 1, detrator: true }),
        item({ alunoNome: "Carla", nota: 2, detrator: true }),
        item({ alunoNome: "Ana", nota: 5 }),
      ],
      detratores: 2,
      notaMaximaDeDetrator: 2,
    });
    render(<AvaliacoesTurma turmaId="t1" />);

    expect(await screen.findByText("2 detratores")).toBeInTheDocument();
    expect(screen.getByText("3 avaliações")).toBeInTheDocument();
  });

  it("sem detrator, diz isso e explica a régua", async () => {
    getAvaliacoesDaTurma.mockResolvedValue({
      itens: [item()],
      detratores: 0,
      notaMaximaDeDetrator: 2,
    });
    render(<AvaliacoesTurma turmaId="t1" />);

    expect(
      await screen.findByText("Nenhum detrator (nota 2 ou menos)."),
    ).toBeInTheDocument();
  });
});

describe("a ordem é a funcionalidade", () => {
  it("a tela NÃO reordena — mostra na ordem que o servidor mandou", async () => {
    // O servidor manda por pior nota. Se a tela ordenasse por conta própria,
    // a régua viraria uma segunda cópia da regra — e é sempre a cópia que
    // fica velha.
    getAvaliacoesDaTurma.mockResolvedValue({
      itens: [
        item({ alunoNome: "Pior", nota: 1, detrator: true }),
        item({ alunoNome: "Meio", nota: 3 }),
        item({ alunoNome: "Melhor", nota: 5 }),
      ],
      detratores: 1,
      notaMaximaDeDetrator: 2,
    });
    render(<AvaliacoesTurma turmaId="t1" />);

    const linhas = await screen.findAllByRole("listitem");
    expect(within(linhas[0]).getByText("Pior")).toBeInTheDocument();
    expect(within(linhas[2]).getByText("Melhor")).toBeInTheDocument();
  });
});

describe("cada linha diz qual aula investigar", () => {
  it("mostra a data da AULA, não a do registro", async () => {
    getAvaliacoesDaTurma.mockResolvedValue({
      itens: [item({ dataDaAula: "2026-08-12", horaInicio: "19:00" })],
      detratores: 0,
      notaMaximaDeDetrator: 2,
    });
    render(<AvaliacoesTurma turmaId="t1" />);

    expect(
      await screen.findByText("aula de 12/08/2026 às 19:00"),
    ).toBeInTheDocument();
  });

  it("mostra nome e comentário — é a única tela que pode", async () => {
    // O aluno e o professor recebem só a média (INV-025a). Aqui é o oposto,
    // e é a decisão do Israel: "somente o painel admin vê quem avaliou e os
    // comentários".
    getAvaliacoesDaTurma.mockResolvedValue({
      itens: [
        item({
          alunoNome: "Ana Souza",
          nota: 2,
          comentario: "O professor faltou duas vezes",
          detrator: true,
        }),
      ],
      detratores: 1,
      notaMaximaDeDetrator: 2,
    });
    render(<AvaliacoesTurma turmaId="t1" />);

    expect(await screen.findByText("Ana Souza")).toBeInTheDocument();
    expect(
      screen.getByText("O professor faltou duas vezes"),
    ).toBeInTheDocument();
  });

  it("a nota é anunciada para leitor de tela, não só desenhada", async () => {
    getAvaliacoesDaTurma.mockResolvedValue({
      itens: [item({ nota: 3 })],
      detratores: 0,
      notaMaximaDeDetrator: 2,
    });
    render(<AvaliacoesTurma turmaId="t1" />);

    expect(await screen.findByLabelText("Nota 3 de 5")).toBeInTheDocument();
  });
});

describe("estado vazio", () => {
  it("turma sem avaliação diz isso", async () => {
    getAvaliacoesDaTurma.mockResolvedValue({
      itens: [],
      detratores: 0,
      notaMaximaDeDetrator: 2,
    });
    render(<AvaliacoesTurma turmaId="t1" />);

    expect(
      await screen.findByText(
        "Nenhum aluno avaliou as aulas desta turma ainda.",
      ),
    ).toBeInTheDocument();
  });
});
