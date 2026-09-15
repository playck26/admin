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
const extrato = vi.hoisted(() => vi.fn());
const disponiveis = vi.hoisted(() => vi.fn());

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
    getExtratoDeCredito: extrato,
    adicionaisDisponiveis: disponiveis,
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
  // R$ 500,00 na carteira do aluno. Quem testa o caso sem saldo sobrescreve.
  extrato.mockResolvedValue({ saldoCentavos: 50_000, movimentos: [] });
  // SPEC-054: clube sem adicional ativo é o caso dos testes anteriores.
  disponiveis.mockResolvedValue([]);
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

/**
 * SPEC-048/REQ-002 — **o saldo do aluno, e o que VAI acontecer.**
 *
 * O cabeçalho dizia *"consome o saldo do aluno, se houver"*, e "se houver" é
 * exatamente o que o gestor não sabia. Pior: a tela mapeava
 * `SALDO_INSUFICIENTE` para *"combine o pagamento por fora"*, como se a aula
 * tivesse falhado — e **o servidor nunca devolve esse código ao gestor**.
 */
describe("SPEC-048 — o saldo do aluno, na tela do gestor", () => {
  it("AC-006: escolhido o aluno, mostra o saldo dele", async () => {
    await preencher(QUINTA);
    expect(
      await screen.findByText(/Saldo do aluno: R\$\s*500,00/),
    ).toBeInTheDocument();
  });

  it("com saldo, diz que a aula nasce PAGA e quanto resta", async () => {
    await preencher(QUINTA);
    fireEvent.change(screen.getByLabelText("Valor da aula (R$)"), {
      target: { value: "250" },
    });
    expect(await screen.findByText(/nasce/)).toHaveTextContent("paga");
    expect(screen.getByText(/Restam R\$\s*250,00/)).toBeInTheDocument();
  });

  it("**AC-007: sem saldo, a frase é 'pendente de pagamento' — não 'falhou'**", async () => {
    extrato.mockResolvedValue({ saldoCentavos: 4_000, movimentos: [] });
    await preencher(QUINTA);
    fireEvent.change(screen.getByLabelText("Valor da aula (R$)"), {
      target: { value: "250" },
    });

    // **A ação do gestor VAI dar certo** (PA-04): a aula é criada, sem débito.
    // Dizer "sem saldo, combine por fora" faria o gestor achar que não passou.
    // `findByText` casa o `<strong>`, que só tem o trecho em negrito — a
    // frase inteira está no parágrafo em volta.
    const negrito = await screen.findByText(/pendente de pagamento/);
    expect(negrito.closest("p")).toHaveTextContent("não cobre");
    expect(screen.queryByText(/combine o pagamento por fora/i)).toBeNull();
  });

  it("a carteira indisponível não impede marcar", async () => {
    extrato.mockRejectedValue(new Error("rede"));
    await preencher(QUINTA);
    expect(screen.queryByText(/Saldo do aluno/)).not.toBeInTheDocument();
    expect(screen.getByLabelText("Valor da aula (R$)")).toBeInTheDocument();
  });
});

/**
 * SPEC-054/D12 e AC-013 — **adicional na aula particular do gestor.**
 *
 * O valor final é o digitado + os adicionais; cortesia na aula não é cortesia
 * da raquete. O saldo anunciado tem de usar o mesmo total que o servidor vai
 * debitar.
 */
describe("SPEC-054 — adicionais na aula particular", () => {
  const RAQUETE = {
    id: "ad-1",
    tipoId: "t-1",
    tipoNome: "Raquetes",
    nome: "Raquete",
    preco: 15,
    disponivel: 3,
  };

  async function aulaDas9(valor: string) {
    await preencher(QUINTA);
    fireEvent.click(screen.getByLabelText("Início"));
    fireEvent.click(await screen.findByRole("option", { name: "09:00" }));
    fireEvent.click(screen.getByLabelText("Fim"));
    fireEvent.click(await screen.findByRole("option", { name: "10:00" }));
    fireEvent.change(screen.getByLabelText(/Valor da aula/), {
      target: { value: valor },
    });
  }

  it("pede a disponibilidade só com o horário escolhido, e para ele", async () => {
    disponiveis.mockResolvedValue([RAQUETE]);
    await preencher(QUINTA);
    expect(disponiveis).not.toHaveBeenCalled();
    await aulaDas9("250");
    await waitFor(() =>
      expect(disponiveis).toHaveBeenCalledWith(QUINTA, ["09:00-10:00"]),
    );
  });

  it("AC-013: 2 raquetes somam ao valor digitado — no saldo anunciado e no pedido", async () => {
    disponiveis.mockResolvedValue([RAQUETE]);
    await aulaDas9("250");
    const mais = await screen.findByRole("button", { name: "Mais Raquete" });
    fireEvent.click(mais);
    fireEvent.click(mais);

    // R$ 500 − (R$ 250 + 2 × R$ 15).
    expect(await screen.findByText(/Restam R\$\s*220,00/)).toBeInTheDocument();
    expect(screen.getByText(/Total: R\$\s*280,00/)).toBeInTheDocument();

    fireEvent.click(screen.getByText("Marcar aula"));
    await waitFor(() => expect(criarReserva).toHaveBeenCalled());
    const [dto] = criarReserva.mock.calls[0] as [
      { valor: number; adicionais?: unknown },
    ];
    // O `valor` enviado continua sendo o da AULA: quem soma é o servidor (D6).
    expect(dto.valor).toBe(250);
    expect(dto.adicionais).toEqual([{ adicionalId: "ad-1", quantidade: 2 }]);
  });

  it("sem escolha, o pedido não leva o campo", async () => {
    disponiveis.mockResolvedValue([RAQUETE]);
    await aulaDas9("250");
    await screen.findByRole("button", { name: "Mais Raquete" });
    fireEvent.click(screen.getByText("Marcar aula"));
    await waitFor(() => expect(criarReserva).toHaveBeenCalled());
    const [dto] = criarReserva.mock.calls[0] as [Record<string, unknown>];
    expect("adicionais" in dto).toBe(false);
  });

  it("LIM-054j: `409 ESTOQUE_ESGOTADO` mostra a mensagem do servidor e relê", async () => {
    disponiveis.mockResolvedValue([RAQUETE]);
    criarReserva.mockRejectedValue(
      new ApiError(409, "Raquete esgotou neste horário.", undefined, "ESTOQUE_ESGOTADO"),
    );
    await aulaDas9("250");
    fireEvent.click(await screen.findByRole("button", { name: "Mais Raquete" }));
    const antes = disponiveis.mock.calls.length;
    fireEvent.click(screen.getByText("Marcar aula"));

    expect(await screen.findByText("Raquete esgotou neste horário.")).toBeInTheDocument();
    await waitFor(() => expect(disponiveis.mock.calls.length).toBeGreaterThan(antes));
  });
});
