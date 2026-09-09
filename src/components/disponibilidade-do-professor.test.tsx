import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DisponibilidadeDoProfessor } from "./disponibilidade-do-professor";
import { ApiError } from "@/lib/api-client";

/**
 * SPEC-040/TASK-003 — a grade da semana na ficha do professor.
 *
 * **O que este arquivo prova é o que só a tela decide.** Que o banco recuse
 * "das 10h às 8h" está provado em `disponibilidade-professor.db-spec.ts`; que
 * a API devolva `422 DIA_REPETIDO`, em `disponibilidade-professor.e2e-spec.ts`.
 * Aqui o assunto é: a grade traduz a assimetria entre `GET` e `PUT`, o dia
 * desmarcado some do corpo, e o erro do servidor chega ao gestor.
 */
const pegar = vi.hoisted(() => vi.fn());
const salvar = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api-client", async () => {
  const real =
    await vi.importActual<typeof import("@/lib/api-client")>("@/lib/api-client");
  return { ...real, getDisponibilidadeDoProfessor: pegar, salvarDisponibilidadeDoProfessor: salvar };
});

const PROF = "prof-1";

/** A resposta do `GET`: sempre sete, com `indisponivel` nos vazios (AC-007). */
function semana(
  atendidos: { diaSemana: number; horaInicio: string; horaFim: string }[],
) {
  return Array.from({ length: 7 }, (_, i) => {
    const a = atendidos.find((x) => x.diaSemana === i);
    return a
      ? { diaSemana: i, indisponivel: false, horaInicio: a.horaInicio, horaFim: a.horaFim }
      : { diaSemana: i, indisponivel: true, horaInicio: null, horaFim: null };
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  pegar.mockResolvedValue(semana([]));
  salvar.mockImplementation((_id: string, dias: never[]) => Promise.resolve(semana(dias)));
});

describe("DisponibilidadeDoProfessor — SPEC-040/TASK-003", () => {
  it("mostra os sete dias, e o professor sem agenda nasce todo desmarcado", async () => {
    render(<DisponibilidadeDoProfessor professorId={PROF} />);

    await waitFor(() => expect(screen.getByLabelText("Atende Domingo")).toBeInTheDocument());
    // Sete caixas, e nenhuma marcada: é o estado inicial de TODO professor já
    // cadastrado (D3), e não um erro de carga.
    const caixas = screen.getAllByRole("checkbox");
    expect(caixas).toHaveLength(7);
    expect(caixas.every((c) => !(c as HTMLInputElement).checked)).toBe(true);
    expect(screen.getAllByText("Não atende")).toHaveLength(7);
  });

  it("AC-007: o dia com linha vem marcado e com as horas do servidor", async () => {
    pegar.mockResolvedValue(semana([{ diaSemana: 1, horaInicio: "09:00", horaFim: "17:00" }]));
    render(<DisponibilidadeDoProfessor professorId={PROF} />);

    await waitFor(() =>
      expect(screen.getByLabelText("Início Segunda-feira")).toHaveValue("09:00"),
    );
    expect(screen.getByLabelText("Fim Segunda-feira")).toHaveValue("17:00");
    expect(screen.getByLabelText("Atende Segunda-feira")).toBeChecked();
    // Os outros seis continuam fora.
    expect(screen.getAllByText("Não atende")).toHaveLength(6);
  });

  it("D6: o PUT manda SÓ os dias atendidos — o desmarcado some do corpo", async () => {
    pegar.mockResolvedValue(
      semana([
        { diaSemana: 1, horaInicio: "08:00", horaFim: "12:00" },
        { diaSemana: 3, horaInicio: "14:00", horaFim: "18:00" },
      ]),
    );
    render(<DisponibilidadeDoProfessor professorId={PROF} />);
    await waitFor(() => expect(screen.getByLabelText("Atende Segunda-feira")).toBeChecked());

    fireEvent.click(screen.getByLabelText("Atende Segunda-feira"));
    fireEvent.click(screen.getByText("Salvar disponibilidade"));

    await waitFor(() => expect(salvar).toHaveBeenCalled());
    // **A asserção que a D6 exige.** Se a segunda-feira aparecesse no corpo
    // com uma flag, o back a gravaria como dia atendido — e não há flag para
    // dizer o contrário.
    expect(salvar).toHaveBeenCalledWith(PROF, [
      { diaSemana: 3, horaInicio: "14:00", horaFim: "18:00" },
    ]);
  });

  it("marcar um dia novo o envia com um expediente plausível, não com 00:00", async () => {
    render(<DisponibilidadeDoProfessor professorId={PROF} />);
    await waitFor(() => expect(screen.getByLabelText("Atende Terça-feira")).toBeInTheDocument());

    fireEvent.click(screen.getByLabelText("Atende Terça-feira"));
    fireEvent.click(screen.getByText("Salvar disponibilidade"));

    await waitFor(() => expect(salvar).toHaveBeenCalled());
    expect(salvar).toHaveBeenCalledWith(PROF, [
      { diaSemana: 2, horaInicio: "08:00", horaFim: "12:00" },
    ]);
  });

  it("`dias: []` é pedido legítimo: desmarcar tudo salva a semana vazia", async () => {
    pegar.mockResolvedValue(semana([{ diaSemana: 5, horaInicio: "08:00", horaFim: "12:00" }]));
    render(<DisponibilidadeDoProfessor professorId={PROF} />);
    await waitFor(() => expect(screen.getByLabelText("Atende Sexta-feira")).toBeChecked());

    fireEvent.click(screen.getByLabelText("Atende Sexta-feira"));
    fireEvent.click(screen.getByText("Salvar disponibilidade"));

    // Não é "nada a fazer": é apagar a agenda, e o servidor precisa ouvir.
    await waitFor(() => expect(salvar).toHaveBeenCalledWith(PROF, []));
  });

  it("AC-003 antes da viagem: fim <= início é recusado sem chamar o servidor", async () => {
    pegar.mockResolvedValue(semana([{ diaSemana: 4, horaInicio: "10:00", horaFim: "18:00" }]));
    render(<DisponibilidadeDoProfessor professorId={PROF} />);
    await waitFor(() => expect(screen.getByLabelText("Fim Quinta-feira")).toHaveValue("18:00"));

    fireEvent.change(screen.getByLabelText("Fim Quinta-feira"), {
      target: { value: "08:00" },
    });
    fireEvent.click(screen.getByText("Salvar disponibilidade"));

    await waitFor(() =>
      expect(
        screen.getByText("Quinta-feira: o fim precisa ser depois do início."),
      ).toBeInTheDocument(),
    );
    // Esta é a rede de CIMA. O back tem a mesma regra e o banco tem o CHECK;
    // aqui ela só evita uma viagem — e por isso o erro nomeia o dia.
    expect(salvar).not.toHaveBeenCalled();
  });

  it("erro do servidor chega ao gestor com a mensagem do servidor", async () => {
    salvar.mockRejectedValue(new ApiError(422, "Dia 1: use hora cheia (ex.: 08:00).", undefined, "HORA_NAO_CHEIA"));
    render(<DisponibilidadeDoProfessor professorId={PROF} />);
    await waitFor(() => expect(screen.getByLabelText("Atende Segunda-feira")).toBeInTheDocument());

    fireEvent.click(screen.getByLabelText("Atende Segunda-feira"));
    fireEvent.click(screen.getByText("Salvar disponibilidade"));

    // O `<select>` só oferece hora cheia, então este erro não deveria chegar.
    // **Ele é tratado mesmo assim:** interface é impedimento, não garantia.
    await waitFor(() =>
      expect(screen.getByText("Dia 1: use hora cheia (ex.: 08:00).")).toBeInTheDocument(),
    );
    expect(screen.queryByText("Disponibilidade salva.")).not.toBeInTheDocument();
  });

  it("depois de salvar, a grade mostra o que o SERVIDOR devolveu", async () => {
    // O servidor devolve algo diferente do que foi enviado — de propósito. Se
    // a tela pintasse o estado local, uma normalização do back ficaria
    // invisível até a próxima carga da página.
    salvar.mockResolvedValue(semana([{ diaSemana: 6, horaInicio: "07:00", horaFim: "11:00" }]));
    render(<DisponibilidadeDoProfessor professorId={PROF} />);
    await waitFor(() => expect(screen.getByLabelText("Atende Sábado")).toBeInTheDocument());

    fireEvent.click(screen.getByLabelText("Atende Sábado"));
    fireEvent.click(screen.getByText("Salvar disponibilidade"));

    await waitFor(() => expect(screen.getByText("Disponibilidade salva.")).toBeInTheDocument());
    expect(screen.getByLabelText("Início Sábado")).toHaveValue("07:00");
    expect(screen.getByLabelText("Fim Sábado")).toHaveValue("11:00");
  });

  it("falha de carga não vira tela em branco", async () => {
    pegar.mockRejectedValue(new ApiError(500, "boom"));
    render(<DisponibilidadeDoProfessor professorId={PROF} />);

    await waitFor(() =>
      expect(
        screen.getByText("Não foi possível carregar a disponibilidade deste professor."),
      ).toBeInTheDocument(),
    );
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });
});
