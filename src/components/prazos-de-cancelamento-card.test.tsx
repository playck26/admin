import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PrazosDeCancelamentoCard } from "./prazos-de-cancelamento-card";

/**
 * SPEC-031/REQ-001 — as provas do lado do gestor.
 *
 * O que este arquivo guarda não é o formulário; é a **distinção entre vazio e
 * zero**, e o aviso do D5b.
 *
 * Vazio é "sem prazo" e precisa ser alcançável de volta — quem pôs 24h e se
 * arrependeu apaga o campo, e o `null` tem de chegar ao servidor como `null`,
 * não como `0`. Um `?? 0` em qualquer ponto do caminho transformaria "sem
 * prazo" em "prazo zero", que é o oposto, e nenhum teste de aparência pegaria
 * isso: os dois desenham a mesma tela.
 */
const getConfigOperacao = vi.hoisted(() => vi.fn());
const definirConfigOperacao = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api-client", async () => {
  const real =
    await vi.importActual<typeof import("@/lib/api-client")>(
      "@/lib/api-client",
    );
  return { ...real, getConfigOperacao, definirConfigOperacao };
});

const SEM_PRAZO = {
  prazoCancelamentoAulaHoras: null,
  prazoCancelamentoReservaHoras: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  getConfigOperacao.mockResolvedValue(SEM_PRAZO);
  definirConfigOperacao.mockImplementation((p: unknown) =>
    Promise.resolve(p),
  );
});

const campoAula = () => screen.getByLabelText(/Sair da turma/);
const campoReserva = () => screen.getByLabelText(/Cancelar reserva/);
const salvar = () => screen.getByRole("button", { name: /Salvar/ });

describe("PrazosDeCancelamentoCard — REQ-001", () => {
  it("empresa sem configuração abre com os dois campos vazios", async () => {
    render(<PrazosDeCancelamentoCard />);

    await waitFor(() => expect(campoAula()).toHaveValue(null));
    expect(campoReserva()).toHaveValue(null);
  });

  it("AC-001: o que o servidor devolve aparece nos campos", async () => {
    getConfigOperacao.mockResolvedValue({
      prazoCancelamentoAulaHoras: 24,
      prazoCancelamentoReservaHoras: 2,
    });
    render(<PrazosDeCancelamentoCard />);

    await waitFor(() => expect(campoAula()).toHaveValue(24));
    expect(campoReserva()).toHaveValue(2);
  });

  it("AC-001: salva os dois prazos e confirma", async () => {
    render(<PrazosDeCancelamentoCard />);
    await waitFor(() => expect(campoAula()).toHaveValue(null));

    fireEvent.change(campoAula(), { target: { value: "24" } });
    fireEvent.change(campoReserva(), { target: { value: "2" } });
    fireEvent.click(salvar());

    await waitFor(() =>
      expect(definirConfigOperacao).toHaveBeenCalledWith({
        prazoCancelamentoAulaHoras: 24,
        prazoCancelamentoReservaHoras: 2,
      }),
    );
    await screen.findByText("Salvo.");
  });

  /**
   * **A prova que justifica o arquivo.** Apagar o campo tem de mandar `null`,
   * e `null` tem de ser distinguível de `0` na chamada — não na tela.
   */
  it("apagar o campo manda null, e null NÃO é zero", async () => {
    getConfigOperacao.mockResolvedValue({
      prazoCancelamentoAulaHoras: 24,
      prazoCancelamentoReservaHoras: 2,
    });
    render(<PrazosDeCancelamentoCard />);
    await waitFor(() => expect(campoAula()).toHaveValue(24));

    fireEvent.change(campoAula(), { target: { value: "" } });
    fireEvent.click(salvar());

    await waitFor(() =>
      expect(definirConfigOperacao).toHaveBeenCalledWith({
        prazoCancelamentoAulaHoras: null,
        prazoCancelamentoReservaHoras: 2,
      }),
    );
    const [enviado] = definirConfigOperacao.mock.calls[0] as [
      { prazoCancelamentoAulaHoras: number | null },
    ];
    expect(enviado.prazoCancelamentoAulaHoras).not.toBe(0);
  });

  /**
   * AC-002 — o servidor recusa com `400`. Esta checagem **antecipa**, não
   * substitui: descobrir "zero não vale" por erro de rede é pior do que ler
   * antes de tentar. A prova é que a requisição **não sai**.
   */
  it.each([
    ["zero", "0"],
    ["negativo", "-3"],
    ["fracionário", "1.5"],
  ])("AC-002: %s não sai da tela", async (_caso, valor) => {
    render(<PrazosDeCancelamentoCard />);
    await waitFor(() => expect(campoAula()).toHaveValue(null));

    fireEvent.change(campoAula(), { target: { value: valor } });
    fireEvent.click(salvar());

    await screen.findByRole("alert");
    expect(definirConfigOperacao).not.toHaveBeenCalled();
  });

  /**
   * AC-003 / D5b — a única mudança de comportamento que esta spec impõe a
   * quem nunca configurou nada. Ela não depende dos campos, e o gestor precisa
   * ler isso **aqui**, não na reclamação do aluno.
   */
  it("diz que depois do começo não dá, mesmo com os campos vazios", async () => {
    render(<PrazosDeCancelamentoCard />);
    await waitFor(() => expect(campoAula()).toHaveValue(null));

    expect(
      screen.getByText(/cancelar é sempre recusado/),
    ).toBeInTheDocument();
  });

  /**
   * Leitura que falha não pode sumir com o cartão: isso deixaria o gestor sem
   * caminho nenhum para configurar. "Sem prazo" é o estado real de quem nunca
   * configurou, então o formulário vazio não mente sobre nada.
   */
  it("erro ao carregar mostra o erro E mantém o formulário utilizável", async () => {
    getConfigOperacao.mockRejectedValue(new Error("rede"));
    render(<PrazosDeCancelamentoCard />);

    await screen.findByRole("alert");
    expect(campoAula()).toBeInTheDocument();

    fireEvent.change(campoAula(), { target: { value: "4" } });
    fireEvent.click(salvar());
    await waitFor(() =>
      expect(definirConfigOperacao).toHaveBeenCalledWith({
        prazoCancelamentoAulaHoras: 4,
        prazoCancelamentoReservaHoras: null,
      }),
    );
  });
});
