import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CourtManager } from "./court-manager";

/**
 * A grade do dia da quadra, e o defeito que este arquivo nasceu para
 * reproduzir.
 *
 * **A tela não tinha teste nenhum**, e o defeito morava exatamente nela.
 *
 * O servidor agrupa horários contíguos numa reserva só (SPEC-011/AC-001):
 * escolher 19–20 e 20–21 grava **uma** ocupação `19:00–21:00`. A grade, porém,
 * desenha slots de 1 hora e casava reserva com slot por **igualdade** de hora
 * de início — então o slot das 20h não achava reserva nenhuma.
 *
 * O resultado era o pior possível numa tela de dinheiro: a reserva de 2h paga
 * com o crédito do aluno (SPEC-033 faz nascer `pago` quando o saldo cobre)
 * mostrava **"Pendente" e "Marcar pago"** na segunda hora — convidando o clube
 * a cobrar de novo o que a carteira acabou de quitar. E os botões eram no-op
 * silencioso: `handleMarkPaid` e `handleCancelSlot` repetiam o mesmo `find` e
 * devolviam sem mensagem.
 *
 * **É a mesma classe do defeito da `cliente#14`**, achada pela revisão
 * adversarial daquela PR ao procurar o padrão em outras telas.
 */
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/quadras",
}));

const pegarQuadra = vi.hoisted(() => vi.fn());
const listarAlunos = vi.hoisted(() => vi.fn());
const disponibilidade = vi.hoisted(() => vi.fn());
const listarReservas = vi.hoisted(() => vi.fn());
const marcarPago = vi.hoisted(() => vi.fn());
const cancelar = vi.hoisted(() => vi.fn());
const listarProfessores = vi.hoisted(() => vi.fn());
const criarReserva = vi.hoisted(() => vi.fn());
const extrato = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api-client", async () => {
  const real =
    await vi.importActual<typeof import("@/lib/api-client")>(
      "@/lib/api-client",
    );
  return {
    ...real,
    getCourt: pegarQuadra,
    listStudents: listarAlunos,
    getExtratoDeCredito: extrato,
    getAvailability: disponibilidade,
    listBookings: listarReservas,
    updateBookingPaymentStatus: marcarPago,
    cancelBooking: cancelar,
    listTeachers: listarProfessores,
    createBooking: criarReserva,
    updateCourt: vi.fn(),
  };
});

const QUADRA = "q-1";
const ALUNO = "a-1";

/**
 * Uma reserva de DUAS horas, ja paga — o caso do defeito.
 *
 * `19:00` a `21:00` numa linha so, que e como o servidor grava depois de
 * agrupar. A grade desenha 19–20 e 20–21 separados.
 */
const RESERVA_DE_DUAS_HORAS = {
  id: "r-1",
  quadraId: QUADRA,
  data: "2099-01-01",
  horaInicio: "19:00",
  horaFim: "21:00",
  statusPagamento: "pago",
  alunoId: ALUNO,
  origemTipo: "AVULSO",
};

beforeEach(() => {
  vi.clearAllMocks();
  pegarQuadra.mockResolvedValue({
    id: QUADRA,
    nome: "Quadra 2",
    precoHora: 100,
    status: "ativa",
    esporte: { id: "e-1", nome: "Tennis" },
  });
  listarAlunos.mockResolvedValue({
    data: [{ id: ALUNO, nome: "Ana", usuario: { nome: "Ana" } }],
    total: 1,
  });
  // R$ 500,00. A quadra custa R$ 100/h — um horário cabe com folga.
  extrato.mockResolvedValue({ saldoCentavos: 50_000, movimentos: [] });
  disponibilidade.mockResolvedValue({
    estado: "aberto",
    slots: [
      { slot: "19:00-20:00", status: "ocupado_avulso" },
      { slot: "20:00-21:00", status: "ocupado_avulso" },
      { slot: "21:00-22:00", status: "livre" },
    ],
  });
  listarReservas.mockResolvedValue({ data: [RESERVA_DE_DUAS_HORAS], total: 1 });
  marcarPago.mockResolvedValue(undefined);
  // **A resposta REAL da rota**, e não `undefined`: ela devolve
  // `{ creditoDevolvidoCentavos }` desde a SPEC-039, e o cliente a descartava.
  // Dublar com `undefined` era o teste concordando com o defeito.
  cancelar.mockResolvedValue({ creditoDevolvidoCentavos: null });
  criarReserva.mockResolvedValue({ reservas: [] });
  listarProfessores.mockResolvedValue({
    data: [
      { id: "p-1", nome: "Joao", status: "ativo" },
      // SPEC-039: o inativo vem da API e NAO pode chegar ao seletor.
      { id: "p-2", nome: "Maria Inativa", status: "inativo" },
    ],
    total: 2,
  });
});

async function abrirGrade() {
  render(<CourtManager id={QUADRA} />);
  // **A grade nao carrega sozinha:** nao ha `useEffect` sobre a data, so o
  // clique em "Ver disponibilidade" (linha 350 do componente). A primeira
  // versao deste arquivo supos carga automatica e os seis casos morreram com
  // `listBookings` nunca chamado.
  fireEvent.click(await screen.findByText("Ver disponibilidade"));
  await waitFor(() => expect(listarReservas).toHaveBeenCalled());
}

describe("CourtManager — a reserva de mais de uma hora", () => {
  it("a SEGUNDA hora de uma reserva paga NAO aparece como pendente", async () => {
    await abrirGrade();

    // O defeito em uma assercao: `Pendente` aparecia UMA vez, no slot das 20h,
    // que e da mesma reserva ja paga.
    await waitFor(() =>
      expect(screen.queryByText("Pendente")).not.toBeInTheDocument(),
    );
  });

  it("e NAO oferece 'Marcar pago' numa hora ja paga", async () => {
    await abrirGrade();

    // Convidar o clube a cobrar de novo o que a carteira do aluno acabou de
    // quitar e o pior erro possivel nesta tela.
    await waitFor(() =>
      expect(screen.queryByText("Marcar pago")).not.toBeInTheDocument(),
    );
  });

  it("as DUAS horas mostram o nome do aluno, nao o generico", async () => {
    await abrirGrade();

    // Sintoma secundario da mesma raiz: sem reserva casada, `alunoId` era
    // `undefined` e a segunda hora caia no rotulo generico.
    await waitFor(() => expect(screen.getAllByText(/Ana/)).toHaveLength(2));
  });

  it("cancelar pela SEGUNDA hora chama o servidor -- nao e no-op silencioso", async () => {
    await abrirGrade();
    const botoes = await screen.findAllByText("Cancelar");
    // O ultimo dos ocupados e o slot das 20h; com o defeito, clicar nele
    // caia em `if (!booking) return` sem mensagem nem estado de carga.
    fireEvent.click(botoes[botoes.length - 1]);

    await waitFor(() => expect(cancelar).toHaveBeenCalledWith("r-1"));
  });

  it("reserva PENDENTE continua mostrando pendente e o botao -- a metade que nao pode quebrar", async () => {
    listarReservas.mockResolvedValue({
      data: [
        { ...RESERVA_DE_DUAS_HORAS, statusPagamento: "pendente_pagamento" },
      ],
      total: 1,
    });
    await abrirGrade();

    // **DUAS vezes, e isso e o certo agora.** Antes da correcao o botao
    // aparecia so na primeira hora, porque a segunda nao casava com reserva
    // nenhuma. As duas linhas sao da MESMA reserva, e clicar em qualquer uma
    // marca essa reserva como paga -- que e o que o gestor espera.
    const botoes = await screen.findAllByText("Marcar pago");
    expect(botoes).toHaveLength(2);

    fireEvent.click(botoes[1]);
    await waitFor(() => expect(marcarPago).toHaveBeenCalledWith("r-1", "pago"));
  });

  it("reservas ADJACENTES: as 21h e da SEGUNDA reserva, nao da primeira", async () => {
    // **O caso que separa `>` de `>=`, e a primeira versao nao o tinha.**
    //
    // Eu escrevi um caso "slot livre nao casa com reserva" e sabotei o `>`
    // para `>=`: os seis testes passaram. O caso nao discriminava, porque
    // slot livre nao mostra status de reserva de qualquer jeito -- era um
    // teste que passava pelo motivo errado, a classe exata que a revisao
    // adversarial mandou procurar.
    //
    // Com DUAS reservas encostadas, `>=` faz o slot das 21h casar com a
    // PRIMEIRA (19-21, paga) e mostrar "Pago" no lugar de "Pendente".
    listarReservas.mockResolvedValue({
      data: [
        RESERVA_DE_DUAS_HORAS,
        {
          ...RESERVA_DE_DUAS_HORAS,
          id: "r-2",
          horaInicio: "21:00",
          horaFim: "22:00",
          statusPagamento: "pendente_pagamento",
        },
      ],
      total: 2,
    });
    disponibilidade.mockResolvedValue({
      estado: "aberto",
      slots: [
        { slot: "19:00-20:00", status: "ocupado_avulso" },
        { slot: "20:00-21:00", status: "ocupado_avulso" },
        { slot: "21:00-22:00", status: "ocupado_avulso" },
      ],
    });
    await abrirGrade();

    // So a terceira hora esta pendente; as duas primeiras sao da reserva paga.
    const botoes = await screen.findAllByText("Marcar pago");
    expect(botoes).toHaveLength(1);

    fireEvent.click(botoes[0]);
    // **`r-2`, e nao `r-1`.** Com `>=`, o clique marcaria a reserva ERRADA
    // como paga -- a que ja estava paga.
    await waitFor(() => expect(marcarPago).toHaveBeenCalledWith("r-2", "pago"));
  });

  it("SPEC-039: o seletor de professor so oferece ATIVOS", async () => {
    await abrirGrade();
    // Um slot livre para o formulario aparecer.
    fireEvent.click(await screen.findByRole("button", { name: /21:00/ }));

    fireEvent.click(await screen.findByLabelText(/Professor/));
    // **`role="option"`, e não o texto.** O Radix pinta o rótulo DUAS vezes —
    // no `select` oculto de acessibilidade e na lista aberta — e
    // `findByText` morre com "found multiple elements".
    expect(
      await screen.findByRole("option", { name: "Joao" }),
    ).toBeInTheDocument();
    // Oferecer quem o servidor vai recusar com `422 PROFESSOR_INATIVO` é
    // fazer o gestor descobrir por erro.
    expect(
      screen.queryByRole("option", { name: "Maria Inativa" }),
    ).not.toBeInTheDocument();
  });

  it("SPEC-039: sem professor, NAO manda `valor` -- o preco e da quadra", async () => {
    await abrirGrade();
    fireEvent.click(await screen.findByRole("button", { name: /21:00/ }));
    fireEvent.click(screen.getByLabelText("Aluno"));
    fireEvent.click(await screen.findByRole("option", { name: "Ana" }));
    fireEvent.click(screen.getByText("Confirmar reserva"));

    await waitFor(() => expect(criarReserva).toHaveBeenCalled());
    const [dto] = criarReserva.mock.calls[0] as [
      { professorId?: string; valor?: number },
    ];
    // **`undefined`, e nao `""` nem `0`.** O servidor recusa `valor` sem
    // professor com `422 VALOR_SEM_PROFESSOR`, e `""` chegaria como UUID
    // invalido no DTO.
    expect(dto.professorId).toBeUndefined();
    expect(dto.valor).toBeUndefined();
  });

  it("SPEC-039: o campo de preco so aparece com professor escolhido", async () => {
    await abrirGrade();
    fireEvent.click(await screen.findByRole("button", { name: /21:00/ }));
    expect(screen.queryByLabelText(/Valor da aula/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText(/Professor/));
    fireEvent.click(await screen.findByRole("option", { name: "Joao" }));

    expect(await screen.findByLabelText(/Valor da aula/)).toBeInTheDocument();
  });

  it("SPEC-039: com professor, manda os DOIS juntos", async () => {
    await abrirGrade();
    fireEvent.click(await screen.findByRole("button", { name: /21:00/ }));
    fireEvent.click(screen.getByLabelText("Aluno"));
    fireEvent.click(await screen.findByRole("option", { name: "Ana" }));
    fireEvent.click(screen.getByLabelText(/Professor/));
    fireEvent.click(await screen.findByRole("option", { name: "Joao" }));
    fireEvent.change(await screen.findByLabelText(/Valor da aula/), {
      target: { value: "250" },
    });
    fireEvent.click(screen.getByText("Confirmar aula"));

    await waitFor(() => expect(criarReserva).toHaveBeenCalled());
    const [dto] = criarReserva.mock.calls[0] as [
      { professorId?: string; valor?: number },
    ];
    expect(dto.professorId).toBe("p-1");
    expect(dto.valor).toBe(250);
  });

  it("SPEC-039: com professor e SEM preco, o botao fica desabilitado", async () => {
    // Sem esta guarda a tela gravaria uma aula de R$ 0 -- que o `CHECK`
    // aceita e ninguem quer. O servidor nao tem como recusar: zero e valor
    // valido, e aula de cortesia existe.
    await abrirGrade();
    fireEvent.click(await screen.findByRole("button", { name: /21:00/ }));
    fireEvent.click(screen.getByLabelText("Aluno"));
    fireEvent.click(await screen.findByRole("option", { name: "Ana" }));
    fireEvent.click(screen.getByLabelText(/Professor/));
    fireEvent.click(await screen.findByRole("option", { name: "Joao" }));

    expect(await screen.findByText("Confirmar aula")).toBeDisabled();
  });
});

/**
 * SPEC-048/REQ-002 — o gestor vê o saldo do aluno, e o que VAI acontecer.
 *
 * O texto do campo de valor dizia *"sai do saldo do aluno se houver"*, e "se
 * houver" é exatamente o que ele não sabia. A diferença importa: com saldo a
 * reserva nasce **paga**; sem saldo ela nasce **devendo** — e as duas dão
 * `201`, então nada na resposta o avisa.
 */
describe("SPEC-048 — o saldo do aluno na reserva do gestor", () => {
  it("AC-006: escolhido o aluno, mostra o saldo dele", async () => {
    await abrirGrade();
    fireEvent.click(await screen.findByRole("button", { name: /21:00/ }));
    fireEvent.click(screen.getByLabelText("Aluno"));
    fireEvent.click(await screen.findByRole("option", { name: "Ana" }));

    expect(
      await screen.findByText(/Saldo do aluno: R\$\s*500,00/),
    ).toBeInTheDocument();
    // R$ 100/h x 1 horário: o saldo cobre, então a reserva nasce paga.
    expect(await screen.findByText(/nasce/)).toHaveTextContent("paga");
  });

  it("**AC-007: sem saldo, diz 'pendente de pagamento' — não 'falhou'**", async () => {
    extrato.mockResolvedValue({ saldoCentavos: 4_000, movimentos: [] });
    await abrirGrade();
    fireEvent.click(await screen.findByRole("button", { name: /21:00/ }));
    fireEvent.click(screen.getByLabelText("Aluno"));
    fireEvent.click(await screen.findByRole("option", { name: "Ana" }));

    // A ação do gestor VAI dar certo (PA-04): a reserva é criada, sem débito.
    const negrito = await screen.findByText(/pendente de pagamento/);
    expect(negrito.closest("p")).toHaveTextContent("não cobre");
  });

  it("sem aluno escolhido, nenhum saldo aparece", async () => {
    await abrirGrade();
    fireEvent.click(await screen.findByRole("button", { name: /21:00/ }));
    // Sem dono, o saldo não é de ninguém — e a tela não inventa um.
    expect(screen.queryByText(/Saldo do aluno/)).not.toBeInTheDocument();
  });

  it("**o saldo carrega DE QUEM ele é — trocar de aluno não herda o anterior**", async () => {
    // Este caso existe porque a sabotagem me pegou: tirar o `saldo.alunoId ===
    // alunoId` **não derrubou teste nenhum**, e era justamente o conserto que
    // eu tinha argumentado ser o certo. Guarda sem prova é opinião.
    listarAlunos.mockResolvedValue({
      data: [
        { id: ALUNO, nome: "Ana", usuario: { nome: "Ana" } },
        { id: "a-2", nome: "Bruno", usuario: { nome: "Bruno" } },
      ],
      total: 2,
    });
    // O segundo aluno **nunca responde**: é o intervalo entre trocar e chegar,
    // e é exatamente onde o saldo do anterior apareceria.
    extrato.mockImplementation((id: string) =>
      id === ALUNO
        ? Promise.resolve({ saldoCentavos: 50_000, movimentos: [] })
        : new Promise(() => {}),
    );

    await abrirGrade();
    fireEvent.click(await screen.findByRole("button", { name: /21:00/ }));
    fireEvent.click(screen.getByLabelText("Aluno"));
    fireEvent.click(await screen.findByRole("option", { name: "Ana" }));
    expect(await screen.findByText(/R\$\s*500,00/)).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Aluno"));
    fireEvent.click(await screen.findByRole("option", { name: "Bruno" }));

    // **O saldo da Ana não pode aparecer sob o nome do Bruno.** Decidir por um
    // número que é de outra pessoa é pior que decidir sem número.
    await waitFor(() =>
      expect(screen.queryByText(/R\$\s*500,00/)).not.toBeInTheDocument(),
    );
  });

  it("**AC-011: cancelar diz quanto voltou para a carteira do aluno**", async () => {
    cancelar.mockResolvedValue({ creditoDevolvidoCentavos: 12_000 });
    await abrirGrade();
    // `findAllByText` e o ULTIMO: o botao aparece uma vez por slot ocupado,
    // e e assim que o caso do "cancelar pela segunda hora" ja faz.
    const botoes = await screen.findAllByText("Cancelar");
    fireEvent.click(botoes[botoes.length - 1]);

    // O gestor cancelando é o gesto que mais move dinheiro nesta tela, e ele
    // só descobriria abrindo a ficha do aluno.
    expect(
      await screen.findByText(/voltaram para a carteira do aluno/),
    ).toHaveTextContent("R$ 120,00");
  });

  it("**e fica CALADO quando não houve devolução**", async () => {
    // Reserva de turma e reserva sem aluno devolvem `null`. Prometer
    // devolução que não houve faz o gestor procurar um movimento que não
    // existe — a mesma regra que a tela do aluno já segue.
    cancelar.mockResolvedValue({ creditoDevolvidoCentavos: null });
    await abrirGrade();
    // `findAllByText` e o ULTIMO: o botao aparece uma vez por slot ocupado,
    // e e assim que o caso do "cancelar pela segunda hora" ja faz.
    const botoes = await screen.findAllByText("Cancelar");
    fireEvent.click(botoes[botoes.length - 1]);

    await waitFor(() => expect(cancelar).toHaveBeenCalled());
    expect(screen.queryByText(/voltaram para a carteira/)).not.toBeInTheDocument();
  });

  it("zero também é silêncio — `> 0`, não `!= null`", async () => {
    cancelar.mockResolvedValue({ creditoDevolvidoCentavos: 0 });
    await abrirGrade();
    // `findAllByText` e o ULTIMO: o botao aparece uma vez por slot ocupado,
    // e e assim que o caso do "cancelar pela segunda hora" ja faz.
    const botoes = await screen.findAllByText("Cancelar");
    fireEvent.click(botoes[botoes.length - 1]);

    await waitFor(() => expect(cancelar).toHaveBeenCalled());
    // "R$ 0,00 voltaram" é pior que silêncio: é uma notícia falsa sobre
    // dinheiro.
    expect(screen.queryByText(/voltaram para a carteira/)).not.toBeInTheDocument();
  });
});
