import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api-client";
import { ImportarAlunos } from "./importar-alunos";

/**
 * SPEC-038/TASK-004 — subir, conferir, importar.
 *
 * **Os dois casos que sustentam a tela:**
 *
 * 1. **"Importar" só libera depois de conferir sem erro.** O servidor recusaria
 *    de qualquer jeito (é tudo ou nada), e deixar o botão vivo convidaria à
 *    tentativa que só volta com o mesmo relatório.
 * 2. **Trocar o arquivo apaga o relatório do anterior.** Sem isso, o gestor
 *    importaria um arquivo tendo conferido outro — e o "tudo ou nada" o
 *    protegeria do estrago, mas não da confusão.
 */
const conferirPlanilha = vi.hoisted(() => vi.fn());
const importarPlanilha = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api-client", async () => {
  const real =
    await vi.importActual<typeof import("@/lib/api-client")>(
      "@/lib/api-client",
    );
  return { ...real, conferirPlanilha, importarPlanilha };
});

function csv(nome = "alunos.csv"): File {
  return new File(["nome,email\nAna,ana@x.com"], nome, { type: "text/csv" });
}

const SEM_ERROS = { total: 2, validas: 2, erros: [], linhas: [] };

beforeEach(() => {
  vi.clearAllMocks();
  conferirPlanilha.mockResolvedValue(SEM_ERROS);
  importarPlanilha.mockResolvedValue({
    criados: [
      {
        linha: 2,
        alunoId: "a-1",
        email: "ana@x.com",
        senhaTemporaria: "Kx7-mQ2p",
      },
    ],
  });
});

function escolherArquivo(nome?: string) {
  render(<ImportarAlunos />);
  fireEvent.change(screen.getByLabelText("Arquivo CSV"), {
    target: { files: [csv(nome)] },
  });
}

describe("ImportarAlunos", () => {
  it("**'Importar' nasce desabilitado** — conferir vem antes", async () => {
    escolherArquivo();
    expect(screen.getByText("Importar")).toBeDisabled();
    expect(screen.getByText("Conferir")).not.toBeDisabled();
  });

  it("conferir sem erro libera o Importar, e diz que pode", async () => {
    escolherArquivo();
    fireEvent.click(screen.getByText("Conferir"));

    expect(await screen.findByText(/Nenhum problema/)).toBeInTheDocument();
    expect(screen.getByText("Importar")).not.toBeDisabled();
    // A conferência NÃO escreve: se tivesse escrito, `importarPlanilha` teria
    // sido chamado, e a prova de "não escreve" é essa ausência.
    expect(importarPlanilha).not.toHaveBeenCalled();
  });

  it("o relatório mostra a LINHA e a coluna de cada problema", async () => {
    conferirPlanilha.mockResolvedValue({
      total: 3,
      validas: 2,
      linhas: [],
      erros: [
        {
          linha: 47,
          coluna: "email",
          mensagem: "Já existe uma conta com este e-mail.",
        },
      ],
    });
    escolherArquivo();
    fireEvent.click(screen.getByText("Conferir"));

    // "O e-mail da linha 47 já existe" é acionável; "há e-mails repetidos"
    // não é. E o número é o da planilha, contando o cabeçalho.
    expect(await screen.findByText(/Linha 47/)).toBeInTheDocument();
    expect(screen.getByText(/Já existe uma conta/)).toBeInTheDocument();
    // Com erro, importar continua barrado.
    expect(screen.getByText("Importar")).toBeDisabled();
  });

  it("**trocar o arquivo apaga o relatório do anterior**", async () => {
    escolherArquivo("primeiro.csv");
    fireEvent.click(screen.getByText("Conferir"));
    await screen.findByText(/Nenhum problema/);

    fireEvent.change(screen.getByLabelText("Arquivo CSV"), {
      target: { files: [csv("segundo.csv")] },
    });

    // Sem isto, o gestor importaria um arquivo tendo conferido outro.
    await waitFor(() =>
      expect(screen.queryByText(/Nenhum problema/)).not.toBeInTheDocument(),
    );
    expect(screen.getByText("Importar")).toBeDisabled();
  });

  it("depois de importar, as senhas aparecem — com o aviso ANTES da lista", async () => {
    escolherArquivo();
    fireEvent.click(screen.getByText("Conferir"));
    await screen.findByText(/Nenhum problema/);
    fireEvent.click(screen.getByText("Importar"));

    expect(await screen.findByText(/1 aluno importado/)).toBeInTheDocument();
    // O aviso vem em cima: depois de fechar a página é tarde, porque nenhuma
    // rota devolve estas senhas de novo.
    expect(screen.getByText(/aparecem uma única vez/)).toBeInTheDocument();
    expect(screen.getByText(/ana@x.com · Kx7-mQ2p/)).toBeInTheDocument();
  });

  it("`PLANILHA_SEM_CABECALHO` manda baixar o modelo", async () => {
    conferirPlanilha.mockRejectedValue(
      new ApiError(422, "crua", undefined, "PLANILHA_SEM_CABECALHO"),
    );
    escolherArquivo();
    fireEvent.click(screen.getByText("Conferir"));

    // A mensagem tem de dizer a SAÍDA. "Cabeçalho inválido" deixaria o gestor
    // adivinhando qual é o certo.
    expect(
      await screen.findByText(/Baixe o modelo abaixo/),
    ).toBeInTheDocument();
  });

  it("sem arquivo, os dois botões ficam barrados", () => {
    render(<ImportarAlunos />);
    expect(screen.getByText("Conferir")).toBeDisabled();
    expect(screen.getByText("Importar")).toBeDisabled();
  });
});
