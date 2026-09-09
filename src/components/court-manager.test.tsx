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

vi.mock("@/lib/api-client", async () => {
  const real =
    await vi.importActual<typeof import("@/lib/api-client")>(
      "@/lib/api-client",
    );
  return {
    ...real,
    getCourt: pegarQuadra,
    listStudents: listarAlunos,
    getAvailability: disponibilidade,
    listBookings: listarReservas,
    updateBookingPaymentStatus: marcarPago,
    cancelBooking: cancelar,
    createBooking: vi.fn(),
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
  cancelar.mockResolvedValue(undefined);
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
});
