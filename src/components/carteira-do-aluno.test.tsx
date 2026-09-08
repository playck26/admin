import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CarteiraDoAluno } from "./carteira-do-aluno";
import { ApiError } from "@/lib/api-client";

/**
 * SPEC-033/TASK-007 — o cartão da carteira na ficha do aluno.
 *
 * **O que este arquivo prova é o que só a tela decide.** O saldo, o débito e
 * a devolução são do banco e estão provados lá (`creditos-service.db-spec.ts`,
 * `creditos-reserva.db-spec.ts`); aqui o assunto é: a senha é pedida a cada
 * lançamento e não sobrevive ao envio, o erro aparece no campo certo, e o
 * extrato mostra o sinal certo por tipo.
 */
const pegarExtrato = vi.hoisted(() => vi.fn());
const lancar = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api-client", async () => {
  const real =
    await vi.importActual<typeof import("@/lib/api-client")>(
      "@/lib/api-client",
    );
  return {
    ...real,
    getExtratoDeCredito: pegarExtrato,
    lancarCredito: lancar,
  };
});

const EXTRATO_VAZIO = { saldoCentavos: 0, movimentos: [] };

function preencher(valor: string, motivo: string, senha: string) {
  fireEvent.change(screen.getByLabelText("Valor"), { target: { value: valor } });
  fireEvent.change(screen.getByLabelText("Motivo"), {
    target: { value: motivo },
  });
  fireEvent.change(screen.getByLabelText("Sua senha"), {
    target: { value: senha },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  pegarExtrato.mockResolvedValue(EXTRATO_VAZIO);
  lancar.mockResolvedValue({ movimentoId: "m1", saldoCentavos: 5000 });
});

describe("CarteiraDoAluno", () => {
  it("mostra o saldo em reais, não em centavos", async () => {
    pegarExtrato.mockResolvedValue({ saldoCentavos: 12_345, movimentos: [] });
    render(<CarteiraDoAluno alunoId="a1" />);

    expect(await screen.findByTestId("saldo-da-carteira")).toHaveTextContent(
      "123,45",
    );
  });

  it("converte o valor digitado em CENTAVOS antes de enviar", async () => {
    render(<CarteiraDoAluno alunoId="a1" />);
    await screen.findByTestId("saldo-da-carteira");

    preencher("12,34", "aporte", "minha-senha");
    fireEvent.click(screen.getByRole("button", { name: "Registrar" }));

    await waitFor(() =>
      expect(lancar).toHaveBeenCalledWith("a1", {
        tipo: "entrada",
        valorCentavos: 1234,
        motivo: "aporte",
        senha: "minha-senha",
      }),
    );
  });

  it("D6: a senha é LIMPA depois do envio, inclusive quando dá certo", async () => {
    render(<CarteiraDoAluno alunoId="a1" />);
    await screen.findByTestId("saldo-da-carteira");

    preencher("10", "aporte", "minha-senha");
    fireEvent.click(screen.getByRole("button", { name: "Registrar" }));

    // Não há sessão elevada: o segundo lançamento pede a senha de novo. Se
    // este campo sobrevivesse, "confirmei há pouco" viraria autorização.
    await waitFor(() =>
      expect(screen.getByLabelText("Sua senha")).toHaveValue(""),
    );
  });

  it("AC-002: senha errada aparece NO CAMPO DA SENHA, e o valor não se perde", async () => {
    lancar.mockRejectedValue(
      new ApiError(422, "Senha incorreta.", undefined, "SENHA_INVALIDA"),
    );
    render(<CarteiraDoAluno alunoId="a1" />);
    await screen.findByTestId("saldo-da-carteira");

    preencher("50", "aporte", "errada");
    fireEvent.click(screen.getByRole("button", { name: "Registrar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Senha incorreta.",
    );
    // Errar a senha não pode custar o que já foi digitado — quem erra a senha
    // erra de novo, e refazer o lançamento inteiro é como se desiste dele.
    expect(screen.getByLabelText("Valor")).toHaveValue("50");
    expect(screen.getByLabelText("Motivo")).toHaveValue("aporte");
  });

  it("AC-004: saldo insuficiente aponta para o VALOR, não para a senha", async () => {
    lancar.mockRejectedValue(
      new ApiError(
        422,
        "Saldo insuficiente: faltam R$ 10,00.",
        undefined,
        "SALDO_INSUFICIENTE",
      ),
    );
    render(<CarteiraDoAluno alunoId="a1" />);
    await screen.findByTestId("saldo-da-carteira");

    fireEvent.click(screen.getByRole("button", { name: "Retirar" }));
    preencher("999", "retirada grande", "minha-senha");
    fireEvent.click(screen.getByRole("button", { name: "Registrar" }));

    const alerta = await screen.findByRole("alert");
    expect(alerta).toHaveTextContent("Saldo insuficiente");
    // O erro fica logo abaixo do campo de valor: é o valor que está grande
    // demais, e mandar olhar a senha mentiria sobre a causa.
    expect(alerta.previousElementSibling).toContainElement(
      screen.getByLabelText("Valor"),
    );
  });

  it("o tipo escolhido vai no corpo — `Retirar` não é só estética", async () => {
    render(<CarteiraDoAluno alunoId="a1" />);
    await screen.findByTestId("saldo-da-carteira");

    fireEvent.click(screen.getByRole("button", { name: "Retirar" }));
    preencher("20", "estorno", "minha-senha");
    fireEvent.click(screen.getByRole("button", { name: "Registrar" }));

    await waitFor(() =>
      expect(lancar).toHaveBeenCalledWith(
        "a1",
        expect.objectContaining({ tipo: "retirada" }),
      ),
    );
  });

  it("D3: o sinal do extrato vem do TIPO, e o consumo aparece como reserva", async () => {
    pegarExtrato.mockResolvedValue({
      saldoCentavos: 4000,
      movimentos: [
        {
          id: "m1",
          tipo: "entrada",
          valorCentavos: 12_000,
          motivo: "aporte",
          ocupacaoId: null,
          criadoEm: "2026-09-08T12:00:00.000Z",
        },
        {
          id: "m2",
          tipo: "consumo",
          valorCentavos: 8000,
          motivo: null,
          ocupacaoId: "o1",
          criadoEm: "2026-09-08T13:00:00.000Z",
        },
      ],
    });
    render(<CarteiraDoAluno alunoId="a1" />);

    expect(await screen.findByText(/Lançamento/)).toHaveTextContent("aporte");
    const linhas = screen.getAllByRole("listitem");
    expect(linhas[0]).toHaveTextContent("+");
    expect(linhas[1]).toHaveTextContent("−");
    expect(linhas[1]).toHaveTextContent("Reserva");
  });

  it("valor não numérico é barrado ANTES de chamar a API", async () => {
    render(<CarteiraDoAluno alunoId="a1" />);
    await screen.findByTestId("saldo-da-carteira");

    preencher("abc", "aporte", "minha-senha");
    fireEvent.click(screen.getByRole("button", { name: "Registrar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "valor maior que zero",
    );
    expect(lancar).not.toHaveBeenCalled();
  });

  it("falha ao carregar não some com a seção — some é falha silenciosa", async () => {
    pegarExtrato.mockRejectedValue(new Error("rede"));
    render(<CarteiraDoAluno alunoId="a1" />);

    expect(
      await screen.findByText(/Não foi possível carregar a carteira/),
    ).toBeInTheDocument();
  });

  it("recarrega o extrato depois de lançar — a tela não fica mentindo", async () => {
    render(<CarteiraDoAluno alunoId="a1" />);
    await screen.findByTestId("saldo-da-carteira");
    expect(pegarExtrato).toHaveBeenCalledTimes(1);

    preencher("10", "aporte", "minha-senha");
    fireEvent.click(screen.getByRole("button", { name: "Registrar" }));

    await waitFor(() => expect(pegarExtrato).toHaveBeenCalledTimes(2));
  });
});
