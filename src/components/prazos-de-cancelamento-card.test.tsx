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

    await waitFor(() => expect(campoAula()).toHaveValue(""));
    expect(campoReserva()).toHaveValue("");
  });

  it("AC-001: o que o servidor devolve aparece nos campos", async () => {
    getConfigOperacao.mockResolvedValue({
      prazoCancelamentoAulaHoras: 24,
      prazoCancelamentoReservaHoras: 2,
    });
    render(<PrazosDeCancelamentoCard />);

    await waitFor(() => expect(campoAula()).toHaveValue("24"));
    expect(campoReserva()).toHaveValue("2");
  });

  it("AC-001: salva os dois prazos e confirma", async () => {
    render(<PrazosDeCancelamentoCard />);
    await waitFor(() => expect(campoAula()).toHaveValue(""));

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
    await waitFor(() => expect(campoAula()).toHaveValue("24"));

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
    await waitFor(() => expect(campoAula()).toHaveValue(""));

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
    await waitFor(() => expect(campoAula()).toHaveValue(""));

    expect(
      screen.getByText(/cancelar é sempre recusado/),
    ).toBeInTheDocument();
  });

  /**
   * **Este bloco existia afirmando o defeito.** A versão anterior deste
   * arquivo rejeitava o `GET`, digitava `4`, e ASSERTAVA que o `PUT` saía com
   * `prazoCancelamentoReservaHoras: null` — ou seja, o teste estava verde na
   * CI provando que o cartão apagava a configuração que não conseguiu ler.
   *
   * Achado por auditoria adversarial em 2026-09-05. O `PUT` é **substituição
   * total**: manda os dois campos sempre. Com a leitura falhada os dois campos
   * ficam vazios, e vazio quer dizer `null`.
   *
   * A lição não é sobre o cartão, é sobre o teste: eu escrevi uma asserção
   * sobre o que o código FAZIA, não sobre o que ele DEVIA fazer, e a asserção
   * passou a defender o defeito.
   */
  describe("leitura que falha (achado de auditoria)", () => {
    /**
     * A rejeicao e montada DENTRO de cada teste, junto do `render`.
     *
     * No `beforeEach` ela vira rejeicao nao tratada: o Vitest roda os hooks e
     * o corpo do teste em ticks diferentes, e a promise nasce sem ninguem
     * escutando. O `.catch` do componente so se liga no `render`.
     */
    const comLeituraFalhada = () => {
      getConfigOperacao.mockImplementation(() =>
        Promise.reject(new Error("rede")),
      );
      return render(<PrazosDeCancelamentoCard />);
    };

    it("mostra o erro e NÃO some com o cartão", async () => {
      comLeituraFalhada();

      await screen.findByRole("alert");
      expect(campoAula()).toBeInTheDocument();
    });

    it("NÃO deixa salvar — salvar apagaria o que não foi lido", async () => {
      comLeituraFalhada();
      await screen.findByRole("alert");

      expect(salvar()).toBeDisabled();

      // E o codigo tambem recusa, nao so a tela: as duas guardas existem
      // porque uma sozinha some no primeiro refactor.
      fireEvent.click(salvar());
      await waitFor(() => expect(getConfigOperacao).toHaveBeenCalled());
      expect(definirConfigOperacao).not.toHaveBeenCalled();
    });

    it("o erro DIZ por que não dá para salvar, não só que falhou", async () => {
      comLeituraFalhada();

      expect(await screen.findByRole("alert")).toHaveTextContent(
        /Recarregue antes de salvar/,
      );
    });

    it("Recarregar é a saída, e ela devolve o cartão utilizável", async () => {
      comLeituraFalhada();
      await screen.findByRole("alert");

      getConfigOperacao.mockResolvedValue({
        prazoCancelamentoAulaHoras: 24,
        prazoCancelamentoReservaHoras: 4,
      });
      fireEvent.click(screen.getByRole("button", { name: "Recarregar" }));

      await waitFor(() => expect(campoAula()).toHaveValue("24"));
      expect(salvar()).not.toBeDisabled();

      // E agora salvar preserva o campo que ele NÃO tocou.
      fireEvent.change(campoAula(), { target: { value: "2" } });
      fireEvent.click(salvar());
      await waitFor(() =>
        expect(definirConfigOperacao).toHaveBeenCalledWith({
          prazoCancelamentoAulaHoras: 2,
          prazoCancelamentoReservaHoras: 4,
        }),
      );
    });
  });

  /**
   * O `input` era `type="number"`, e o browser sanitiza: texto que ele não
   * considera número chega ao `onChange` como string **vazia** — que aqui
   * significa "sem prazo". Colar "24h" gravava a REMOÇÃO do prazo dizendo
   * "Salvo.". A validação local nunca via o texto.
   */
  describe("texto inválido chega até a validação (achado de auditoria)", () => {
    it.each([["24h"], ["2-4"], ["-"], ["0x10"], ["1e3"], ["abc"]])(
      "%s é recusado na tela, e não vira 'sem prazo'",
      async (texto) => {
        render(<PrazosDeCancelamentoCard />);
        await waitFor(() => expect(campoAula()).toHaveValue(""));

        fireEvent.change(campoAula(), { target: { value: texto } });
        fireEvent.click(salvar());

        await screen.findByRole("alert");
        expect(definirConfigOperacao).not.toHaveBeenCalled();
      },
    );

    /**
     * `0x10` e `1e3` merecem menção: `Number()` os aceita (16 e 1000), e a
     * versão anterior usava `Number()`. Nenhum dos dois é o que o gestor quis
     * dizer ao digitar.
     */
    it("acima do teto do INTEGER é recusado ANTES de morrer no Prisma", async () => {
      render(<PrazosDeCancelamentoCard />);
      await waitFor(() => expect(campoAula()).toHaveValue(""));

      fireEvent.change(campoAula(), { target: { value: "9999999999" } });
      fireEvent.click(salvar());

      await screen.findByRole("alert");
      expect(definirConfigOperacao).not.toHaveBeenCalled();
    });

    it("o maior valor que a coluna aguenta AINDA passa", async () => {
      render(<PrazosDeCancelamentoCard />);
      await waitFor(() => expect(campoAula()).toHaveValue(""));

      fireEvent.change(campoAula(), { target: { value: "2147483647" } });
      fireEvent.click(salvar());

      await waitFor(() =>
        expect(definirConfigOperacao).toHaveBeenCalledWith({
          prazoCancelamentoAulaHoras: 2147483647,
          prazoCancelamentoReservaHoras: null,
        }),
      );
    });
  });
});
