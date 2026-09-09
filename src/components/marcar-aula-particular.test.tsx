import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api-client";
import { MarcarAulaParticular } from "./marcar-aula-particular";

/**
 * SPEC-039 — marcar aula na ficha do professor.
 *
 * **Este componente nasceu de um defeito de produto, não de um requisito
 * novo.** A tela da quadra já marcava aula particular, e o Israel abriu o
 * Admin procurando e não achou: lá o seletor de professor vive dentro do
 * formulário de reserva, que só nasce depois de escolher a data, pedir a
 * disponibilidade e clicar num horário. Feature que existe e não é alcançável
 * é feature que não existe.
 *
 * O que estes casos guardam é o que só esta tela faz: **avisar antes de
 * enviar** que o professor não atende naquele dia, em vez de deixar o gestor
 * descobrir por `422`.
 */
const listarAlunos = vi.hoisted(() => vi.fn());
const listarQuadras = vi.hoisted(() => vi.fn());
const pegarDisponibilidade = vi.hoisted(() => vi.fn());
const criarReserva = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api-client", async () => {
  const real =
    await vi.importActual<typeof import("@/lib/api-client")>(
      "@/lib/api-client",
    );
  return {
    ...real,
    listStudents: listarAlunos,
    listCourts: listarQuadras,
    getDisponibilidadeDoProfessor: pegarDisponibilidade,
    createBooking: criarReserva,
  };
});

const PROF = "p-1";

/** `2035-06-07` é **quinta** (dia 4) — data e dia da semana têm de casar. */
const QUINTA = "2035-06-07";
const SEXTA = "2035-06-08";

/** Atende só na quinta, das 08:00 às 12:00. */
function semana(): unknown[] {
  return Array.from({ length: 7 }, (_, i) =>
    i === 4
      ? {
          diaSemana: i,
          indisponivel: false,
          horaInicio: "08:00",
          horaFim: "12:00",
        }
      : { diaSemana: i, indisponivel: true, horaInicio: null, horaFim: null },
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  listarAlunos.mockResolvedValue({
    data: [{ id: "a-1", nome: "Ana" }],
    total: 1,
  });
  listarQuadras.mockResolvedValue({
    data: [
      { id: "q-1", nome: "Quadra 1", status: "ativa" },
      // Quadra inativa nao recebe aula nova, e oferecer aqui seria oferecer o
      // que o servidor recusa.
      { id: "q-2", nome: "Quadra Fechada", status: "inativa" },
    ],
    total: 2,
  });
  pegarDisponibilidade.mockResolvedValue(semana());
  criarReserva.mockResolvedValue({ reservas: [{ id: "r-1" }] });
});

/** Preenche tudo menos a data, que cada caso escolhe. */
async function preencher(data: string) {
  render(<MarcarAulaParticular professorId={PROF} />);
  fireEvent.click(await screen.findByLabelText("Aluno"));
  fireEvent.click(await screen.findByRole("option", { name: "Ana" }));
  fireEvent.click(screen.getByLabelText("Quadra"));
  fireEvent.click(await screen.findByRole("option", { name: "Quadra 1" }));
  fireEvent.change(screen.getByLabelText("Data"), { target: { value: data } });
}

describe("MarcarAulaParticular", () => {
  it("avisa a janela do professor no dia escolhido -- ANTES de enviar", async () => {
    await preencher(QUINTA);
    // É isto que faz esta tela valer mais que a da quadra: o gestor vê o
    // horário de atendimento sem precisar tentar e tomar `422`.
    expect(await screen.findByText(/das 08:00 às 12:00/)).toBeInTheDocument();
  });

  it("dia em que ele NAO atende avisa, e manda configurar a disponibilidade", async () => {
    await preencher(SEXTA);
    // Ausência de linha é "não atende" (SPEC-040/D3), e é o estado inicial de
    // todo professor já cadastrado — então este é o caminho MAIS comum, não a
    // borda.
    expect(
      await screen.findByText(/Não atende sexta-feira/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Configure a disponibilidade acima/),
    ).toBeInTheDocument();
  });

  it("as horas oferecidas ficam DENTRO da janela", async () => {
    await preencher(QUINTA);
    fireEvent.click(screen.getByLabelText("Início"));

    expect(
      await screen.findByRole("option", { name: "08:00" }),
    ).toBeInTheDocument();
    // 14:00 está fora de 08:00–12:00: oferecer seria convidar ao erro.
    expect(
      screen.queryByRole("option", { name: "14:00" }),
    ).not.toBeInTheDocument();
  });

  it("quadra INATIVA nao aparece", async () => {
    render(<MarcarAulaParticular professorId={PROF} />);
    fireEvent.click(await screen.findByLabelText("Quadra"));

    expect(
      await screen.findByRole("option", { name: "Quadra 1" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("option", { name: "Quadra Fechada" }),
    ).not.toBeInTheDocument();
  });

  it("manda `professorId` e `valor` juntos, com o professor DA FICHA", async () => {
    await preencher(QUINTA);
    fireEvent.click(screen.getByLabelText("Início"));
    fireEvent.click(await screen.findByRole("option", { name: "09:00" }));
    fireEvent.click(screen.getByLabelText("Fim"));
    fireEvent.click(await screen.findByRole("option", { name: "10:00" }));
    fireEvent.change(screen.getByLabelText(/Valor da aula/), {
      target: { value: "250" },
    });
    fireEvent.click(screen.getByText("Marcar aula"));

    await waitFor(() => expect(criarReserva).toHaveBeenCalled());
    const [dto] = criarReserva.mock.calls[0] as [
      { professorId: string; valor: number; alunoId: string },
    ];
    // **O professor vem da URL, não de um seletor.** É a diferença desta tela:
    // ninguém escolhe o professor duas vezes.
    expect(dto.professorId).toBe(PROF);
    expect(dto.valor).toBe(250);
    expect(dto.alunoId).toBe("a-1");
  });

  it("o botao so libera com TUDO preenchido", async () => {
    await preencher(QUINTA);
    // Sem hora e sem valor, enviar gravaria aula de R$ 0 num horário nulo.
    expect(screen.getByText("Marcar aula")).toBeDisabled();
  });

  it("o erro do servidor vira mensagem por CODE, nao por texto", async () => {
    criarReserva.mockRejectedValue(
      new ApiError(
        409,
        "mensagem crua do servidor",
        undefined,
        "PROFESSOR_INDISPONIVEL",
      ),
    );
    await preencher(QUINTA);
    fireEvent.click(screen.getByLabelText("Início"));
    fireEvent.click(await screen.findByRole("option", { name: "09:00" }));
    fireEvent.click(screen.getByLabelText("Fim"));
    fireEvent.click(await screen.findByRole("option", { name: "10:00" }));
    fireEvent.change(screen.getByLabelText(/Valor da aula/), {
      target: { value: "100" },
    });
    fireEvent.click(screen.getByText("Marcar aula"));

    // A mensagem menciona a aula de TURMA, que é o caso que o gestor não
    // adivinharia — a trava do banco não enxerga turma, e quem recusa é o
    // gate da aplicação (LIM-039f).
    expect(
      await screen.findByText(/já tem compromisso neste horário/),
    ).toBeInTheDocument();
  });
});
