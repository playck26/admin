import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api-client";
import { MatriculaDoAluno } from "./matricula-do-aluno";

/**
 * SPEC-037/TASK-005 — matricular, na ficha do aluno.
 *
 * **Os dois casos que mais valem:**
 *
 * 1. **valor em branco vira `undefined`, nunca `0`.** Zero é bolsa integral,
 *    um valor legítimo — mandá-lo por engano daria o plano de graça, e
 *    ninguém desconfia de uma matrícula que "salvou".
 * 2. **as três recusas têm saídas diferentes.** `CONTRATO_NAO_ACEITO` pede ao
 *    aluno; `CONTRATO_NAO_PUBLICADO` pede ao gestor; `PLANO_INATIVO` pede
 *    outro plano. Sem a distinção, as três virariam "não foi possível".
 */
const listarMatriculas = vi.hoisted(() => vi.fn());
const listarPlanos = vi.hoisted(() => vi.fn());
const criarMatricula = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api-client", async () => {
  const real =
    await vi.importActual<typeof import("@/lib/api-client")>(
      "@/lib/api-client",
    );
  return { ...real, listarMatriculas, listarPlanos, criarMatricula };
});

const ALUNO = "a-1";
const PLANO = {
  id: "p-1",
  nome: "Mensal",
  valorCentavos: 30000,
  prazoMeses: 1,
  linkPagamentoUrl: null,
  linkHerdado: true,
  ativo: true,
};

function matricula(extra: Record<string, unknown> = {}) {
  return {
    id: "m-1",
    alunoId: ALUNO,
    planoId: PLANO.id,
    planoNome: "Mensal",
    valorCentavos: 30000,
    valorDeTabelaCentavos: 30000,
    descontoCentavos: 0,
    prazoMeses: 1,
    inicio: "2026-09-10",
    fim: "2026-10-10",
    contratoVersao: 3,
    linkPagamentoUrl: null,
    ...extra,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  listarMatriculas.mockResolvedValue([]);
  listarPlanos.mockResolvedValue([PLANO]);
  criarMatricula.mockResolvedValue(matricula());
});

async function escolherPlano() {
  render(<MatriculaDoAluno alunoId={ALUNO} />);
  fireEvent.click(await screen.findByLabelText("Plano"));
  fireEvent.click(await screen.findByRole("option", { name: /Mensal/ }));
}

describe("MatriculaDoAluno", () => {
  it("sem matrícula, diz isso — e não fica em branco", async () => {
    render(<MatriculaDoAluno alunoId={ALUNO} />);
    expect(
      await screen.findByText(/ainda não tem matrícula/),
    ).toBeInTheDocument();
  });

  it("**valor em branco vira `undefined`, e NUNCA `0`**", async () => {
    await escolherPlano();
    fireEvent.click(screen.getByText("Matricular"));

    await waitFor(() => expect(criarMatricula).toHaveBeenCalled());
    const [, dto] = criarMatricula.mock.calls[0] as [
      string,
      Record<string, unknown>,
    ];
    // Zero é bolsa integral. `Number("") === 0` é a armadilha, e ela daria o
    // plano de graça sem ninguém perceber.
    expect(dto.valorCentavos).toBeUndefined();
    expect(dto.planoId).toBe("p-1");
  });

  it("valor digitado vira CENTAVOS, com arredondamento", async () => {
    await escolherPlano();
    fireEvent.change(screen.getByLabelText(/Valor combinado/), {
      target: { value: "299.90" },
    });
    fireEvent.click(screen.getByText("Matricular"));

    await waitFor(() => expect(criarMatricula).toHaveBeenCalled());
    const [, dto] = criarMatricula.mock.calls[0] as [
      string,
      Record<string, unknown>,
    ];
    // `299.9 * 100` é `29989.999…` em ponto flutuante. Sem `Math.round`, o
    // truncamento perderia um centavo por matrícula.
    expect(dto.valorCentavos).toBe(29990);
  });

  it("o desconto aparece com o valor de TABELA ao lado", async () => {
    listarMatriculas.mockResolvedValue([
      matricula({ valorCentavos: 25000, descontoCentavos: 5000 }),
    ]);
    render(<MatriculaDoAluno alunoId={ALUNO} />);

    // Só é possível mostrar isto porque a matrícula congelou os DOIS valores.
    // Com um só, ninguém distinguiria desconto de mudança de preço depois.
    expect(
      await screen.findByText(/desconto de R\$\s*50,00 sobre R\$\s*300,00/),
    ).toBeInTheDocument();
  });

  it("`CONTRATO_NAO_ACEITO` manda pedir ao ALUNO", async () => {
    criarMatricula.mockRejectedValue(
      new ApiError(422, "crua", undefined, "CONTRATO_NAO_ACEITO"),
    );
    await escolherPlano();
    fireEvent.click(screen.getByText("Matricular"));

    expect(
      await screen.findByText(/Peça que ele entre no app e aceite/),
    ).toBeInTheDocument();
  });

  it("`CONTRATO_NAO_PUBLICADO` manda o GESTOR publicar — saída diferente", async () => {
    criarMatricula.mockRejectedValue(
      new ApiError(422, "crua", undefined, "CONTRATO_NAO_PUBLICADO"),
    );
    await escolherPlano();
    fireEvent.click(screen.getByText("Matricular"));

    // As duas recusas falam de contrato e têm soluções que não se parecem.
    expect(
      await screen.findByText(/Publique em Configurações/),
    ).toBeInTheDocument();
  });

  it("sem plano ATIVO, avisa onde criar — em vez de um seletor vazio", async () => {
    listarPlanos.mockResolvedValue([]);
    render(<MatriculaDoAluno alunoId={ALUNO} />);

    expect(await screen.findByText(/Nenhum plano ativo/)).toBeInTheDocument();
    expect(screen.getByText("Matricular")).toBeDisabled();
  });
});
