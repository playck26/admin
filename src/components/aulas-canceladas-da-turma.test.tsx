import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api-client";
import { AulasCanceladasDaTurma } from "./aulas-canceladas-da-turma";

/**
 * SPEC-035/TASK-004 — a porta da reativação.
 *
 * **O que estes casos guardam é o que só esta tela faz:** mostrar o que a
 * agenda esconde. Os três filtros de `agenda.service.ts` excluem
 * `cancelado`, e isso está certo para o que a agenda é — mas torna a aula
 * cancelada invisível, e não se reativa o que não se vê.
 *
 * O caso do `horarioLivre: false` é o mais importante: ele prova que a tela
 * **avisa sem prometer**. O botão continua clicável, porque quem decide é a
 * `EXCLUDE` do servidor, que pode ter uma verdade mais nova nos dois
 * sentidos.
 */
const listar = vi.hoisted(() => vi.fn());
const reativar = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api-client", async () => {
  const real =
    await vi.importActual<typeof import("@/lib/api-client")>(
      "@/lib/api-client",
    );
  return {
    ...real,
    listarAulasCanceladas: listar,
    reativarOcorrenciaDeTurma: reativar,
  };
});

const TURMA = "t-1";

/** `2035-06-07` é **quinta** — data e dia da semana têm de casar. */
const AULA = {
  ocupacaoId: "o-1",
  data: "2035-06-07",
  horaInicio: "18:00",
  horaFim: "19:00",
  quadraNome: "Quadra 1",
  horarioLivre: true,
};

beforeEach(() => {
  vi.clearAllMocks();
  listar.mockResolvedValue([AULA]);
  reativar.mockResolvedValue(undefined);
});

async function preencherMotivo(texto: string) {
  render(<AulasCanceladasDaTurma turmaId={TURMA} />);
  const campo = await screen.findByLabelText("Motivo da reativação");
  fireEvent.change(campo, { target: { value: texto } });
}

describe("AulasCanceladasDaTurma", () => {
  it("mostra a aula com dia da semana, horário e quadra", async () => {
    render(<AulasCanceladasDaTurma turmaId={TURMA} />);
    // O dia por extenso sai de `Date.UTC` com as partes explícitas: `new
    // Date("2035-06-07")` seria interpretado em UTC e viraria quarta em
    // fuso negativo — a mesma armadilha da DEF-020.
    expect(await screen.findByText(/Quinta-feira, 07\/06/)).toBeInTheDocument();
    expect(screen.getByText(/18:00–19:00 · Quadra 1/)).toBeInTheDocument();
  });

  it("lista vazia diz isso, e não fica em branco", async () => {
    listar.mockResolvedValue([]);
    render(<AulasCanceladasDaTurma turmaId={TURMA} />);
    expect(
      await screen.findByText(/Nenhuma aula cancelada desta turma/),
    ).toBeInTheDocument();
  });

  it("avisa quando o horário já foi ocupado — e NÃO desabilita o botão", async () => {
    listar.mockResolvedValue([{ ...AULA, horarioLivre: false }]);
    await preencherMotivo("A quadra foi liberada");

    expect(
      screen.getByText(/O horário já foi ocupado por outra reserva/),
    ).toBeInTheDocument();
    // **Avisar não é decidir.** `horarioLivre` foi calculado na leitura e pode
    // ter envelhecido nos dois sentidos; desabilitar mentiria sobre quem
    // manda.
    expect(screen.getByText("Reativar aula")).not.toBeDisabled();
  });

  it("o botão só libera com motivo de 3 caracteres ou mais", async () => {
    await preencherMotivo("ok");
    // 3 a 280 é a regra do servidor. Barrar aqui evita a ida que só voltaria
    // `422` — e "ok" é exatamente o caso que a regra existe para recusar.
    expect(screen.getByText("Reativar aula")).toBeDisabled();
  });

  it("reativa mandando turma, ocupação e motivo, e recarrega", async () => {
    await preencherMotivo("A quadra foi liberada");
    fireEvent.click(screen.getByText("Reativar aula"));

    await waitFor(() =>
      expect(reativar).toHaveBeenCalledWith(
        TURMA,
        "o-1",
        "A quadra foi liberada",
      ),
    );
    // Recarrega: a aula reativada sai da lista, e sem isto ela ficaria na
    // tela convidando a um segundo clique que só voltaria idempotente.
    await waitFor(() => expect(listar).toHaveBeenCalledTimes(2));
  });

  it("`HORARIO_OCUPADO` vira mensagem por CODE, e diz QUEM tomou", async () => {
    reativar.mockRejectedValue(
      new ApiError(
        409,
        "mensagem crua do servidor",
        { ocupacaoId: "x", origemTipo: "AVULSO" },
        "HORARIO_OCUPADO",
      ),
    );
    await preencherMotivo("A quadra foi liberada");
    fireEvent.click(screen.getByText("Reativar aula"));

    expect(
      await screen.findByText(/Uma reserva avulsa tomou o lugar/),
    ).toBeInTheDocument();
  });

  it("`PRAZO_DE_CANCELAMENTO` manda para a chamada, não repete 'tente de novo'", async () => {
    reativar.mockRejectedValue(
      new ApiError(409, "crua", undefined, "PRAZO_DE_CANCELAMENTO"),
    );
    await preencherMotivo("Tentativa fora de hora");
    fireEvent.click(screen.getByText("Reativar aula"));

    // A aula já começou: insistir não resolve. O caminho é declarar que ela
    // não aconteceu, e a mensagem tem de dizer isso.
    expect(await screen.findByText(/use a chamada/)).toBeInTheDocument();
  });
});
