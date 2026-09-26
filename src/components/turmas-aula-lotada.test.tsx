import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { avisoDeAulaLotada, diaEMes } from "@/lib/aula-lotada";
import { ClassesList } from "./classes-list";
import { ClassManager } from "./class-manager";

/**
 * ADR-027 (achado A-04 da validação da implementação da SPEC-075) — **a tela
 * do gestor não anuncia a vaga que a alocação recusa.** O Back traz, na lista
 * e no detalhe da turma, `proximaAulaLotada`; antes, o gestor via "0/1" e
 * recebia `409 AULA_LOTADA` ao alocar.
 */
const listClasses = vi.hoisted(() => vi.fn());
const getClass = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api-client", async () => {
  const real =
    await vi.importActual<typeof import("@/lib/api-client")>(
      "@/lib/api-client",
    );
  return {
    ...real,
    listClasses,
    getClass,
    listCourts: vi.fn().mockResolvedValue({ data: [], total: 0 }),
    listLevels: vi.fn().mockResolvedValue([]),
    listTeachers: vi.fn().mockResolvedValue({ data: [], total: 0 }),
    listStudents: vi.fn().mockResolvedValue({ data: [], total: 0 }),
    listarAulasCanceladas: vi.fn().mockResolvedValue([]),
  };
});

vi.mock("@/components/turma-chamada-abas", () => ({
  TurmaChamadaAbas: () => null,
}));

afterEach(cleanup);

function turma(over: Record<string, unknown> = {}) {
  return {
    id: "t-1",
    companyId: "c-1",
    nome: "Turma A",
    nivelId: null,
    professorId: null,
    quadraId: "q-1",
    capacidade: 1,
    status: "ativa",
    encontros: [{ diaSemana: 6, horaInicio: "20:00", horaFim: "21:00" }],
    alunosAlocados: 0,
    proximaAulaLotada: null,
    alunos: [],
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("o texto (src/lib/aula-lotada.ts)", () => {
  it("dd/mm por fatia da data do clube — e não por new Date, que em UTC−3 volta um dia", () => {
    expect(diaEMes("2026-10-03")).toBe("03/10");
    expect(diaEMes("2026-01-01")).toBe("01/01");
  });

  it("o aviso inteiro", () => {
    expect(avisoDeAulaLotada("2026-10-03")).toBe(
      "A aula de 03/10 já está lotada, contando as reposições marcadas: um aluno novo só cabe depois dela.",
    );
  });
});

describe("a lista de turmas", () => {
  it("diz 'Lotada em dd/mm' só na turma que tem aula lotada", async () => {
    listClasses.mockResolvedValue({
      data: [
        turma({ id: "t-1", nome: "Lotada", proximaAulaLotada: "2026-10-03" }),
        turma({ id: "t-2", nome: "Livre" }),
      ],
      page: 1,
      pageSize: 20,
      total: 2,
    });
    render(<ClassesList />);
    const linhaLotada = (await screen.findByText("Lotada")).closest("tr") as HTMLElement;
    const linhaLivre = screen.getByText("Livre").closest("tr") as HTMLElement;
    expect(linhaLotada).toHaveTextContent("Lotada em 03/10");
    expect(linhaLivre).not.toHaveTextContent("Lotada em");
  });
});

describe("a página da turma", () => {
  it("avisa o dia lotado e NÃO bloqueia a alocação — o visitante daquela aula ainda cabe", async () => {
    getClass.mockResolvedValue(turma({ proximaAulaLotada: "2026-10-03" }));
    render(<ClassManager id="t-1" />);
    expect(await screen.findByRole("status")).toHaveTextContent(
      avisoDeAulaLotada("2026-10-03"),
    );
    expect(screen.getByRole("button", { name: "Alocar aluno" })).toBeInTheDocument();
    expect(screen.queryByText("Turma sem vagas")).not.toBeInTheDocument();
  });

  it("sem aula lotada, não há aviso", async () => {
    getClass.mockResolvedValue(turma());
    render(<ClassManager id="t-1" />);
    await screen.findByText("0/1 vagas ocupadas");
    expect(screen.queryByText(/já está lotada/)).not.toBeInTheDocument();
  });
});
