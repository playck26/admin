import { createHash } from "node:crypto";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

/**
 * SPEC-083/AC-006 — **o "Baixar modelo" publica os bytes da fixture do Back.**
 *
 * O SHA-256 abaixo é o de `apps/Back/test/fixtures/modelo-alunos.csv` e o de
 * `specs/changes/083-o-convite-que-chega-por-email/modelo-alunos.csv` (os dois
 * são o mesmo arquivo, 208 bytes, conferido com `sha256sum` em 2026-10-04). Em
 * poly-repo o CI do Admin não tem `../Back`, então o número fica aqui; a
 * comparação cruzada vai ao `CLI_AUDIT.md`. A fixture passa na conferência do
 * Back sem erro de cabeçalho (AC-001, AC-006, do lado de lá).
 */
const SHA256_DA_FIXTURE_DO_BACK =
  "5846b7ea861fef5fcf032c45f4cad048a5ffb4ca393f90aa99c3a25310a771a6";

describe("SPEC-083/AC-006 — o modelo novo", () => {
  let blobs: Blob[];
  let baixados: string[];

  beforeEach(() => {
    blobs = [];
    baixados = [];
    // O jsdom não implementa `createObjectURL` nem navegação: o que importa
    // é o Blob entregue, e o clique no link só precisa não navegar.
    vi.spyOn(URL, "createObjectURL").mockImplementation((b) => {
      blobs.push(b as Blob);
      return "blob:modelo";
    });
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(
      function (this: HTMLAnchorElement) {
        baixados.push(this.download);
      },
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  async function bytesBaixados(): Promise<Buffer> {
    render(<ImportarAlunos />);
    fireEvent.click(screen.getByText("Baixar modelo"));
    expect(blobs).toHaveLength(1);
    return Buffer.from(await blobs[0].arrayBuffer());
  }

  it("começa com o BOM UTF-8 e com `nome;email;telefone;nivel;turma`", async () => {
    const bytes = await bytesBaixados();
    expect([...bytes.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    expect(bytes.subarray(3).toString("utf8").split("\r\n")[0]).toBe(
      "nome;email;telefone;nivel;turma",
    );
  });

  it("CRLF em toda linha, e nenhuma coluna do formato antigo", async () => {
    const texto = (await bytesBaixados()).toString("utf8");
    // Todo `\n` vem depois de um `\r`, e o arquivo termina em CRLF.
    expect(texto.match(/\n/g)?.length).toBe(texto.match(/\r\n/g)?.length);
    expect(texto.endsWith("\r\n")).toBe(true);
    // I5: "retire aquela data, numero etc".
    expect(texto).not.toMatch(/dataNascimento|emergencia/);
  });

  it("**os bytes são os da fixture do Back** (SHA-256)", async () => {
    const bytes = await bytesBaixados();
    expect(bytes.length).toBe(208);
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(
      SHA256_DA_FIXTURE_DO_BACK,
    );
  });

  it("baixa como `modelo-alunos.csv`", async () => {
    await bytesBaixados();
    expect(baixados).toEqual(["modelo-alunos.csv"]);
  });
});

/**
 * SPEC-083/AC-016, AC-017, AC-019 — **quem recebe convite é escolhido na
 * conferência**, e só esses recebem.
 */
function linha(n: number) {
  return {
    linha: n,
    nome: `Pessoa ${n}`,
    email: `p${n}@x.com`,
    telefone: null,
    nivelId: null,
    turmaId: null,
    turmaNome: null,
  };
}

const QUATRO_VALIDAS = {
  total: 4,
  validas: 4,
  erros: [],
  linhas: [linha(2), linha(3), linha(4), linha(5)],
};

async function conferirComLinhas() {
  conferirPlanilha.mockResolvedValue(QUATRO_VALIDAS);
  escolherArquivo();
  fireEvent.click(screen.getByText("Conferir"));
  await screen.findByText(/Nenhum problema/);
}

function caixa(n: number): HTMLElement {
  return screen.getByRole("checkbox", { name: new RegExp(`linha ${n},`) });
}

describe("SPEC-083/AC-016 — a lista das linhas válidas com a caixa", () => {
  it("cada linha válida tem a caixa, e **todas começam desmarcadas**", async () => {
    await conferirComLinhas();

    const caixas = screen.getAllByRole("checkbox");
    expect(caixas).toHaveLength(4);
    for (const c of caixas) expect(c).not.toBeChecked();
    expect(screen.getAllByText("enviar convite por e-mail")).toHaveLength(4);
    expect(screen.getByTestId("contador-de-convites")).toHaveTextContent(
      "Nenhum convite por e-mail vai sair.",
    );
  });

  it("marcar uma a uma: o contador acompanha", async () => {
    await conferirComLinhas();
    const contador = screen.getByTestId("contador-de-convites");

    fireEvent.click(caixa(3));
    expect(contador).toHaveTextContent("1 convite por e-mail vai sair.");
    fireEvent.click(caixa(5));
    expect(contador).toHaveTextContent("2 convites por e-mail vão sair.");
    fireEvent.click(caixa(3));
    expect(contador).toHaveTextContent("1 convite por e-mail vai sair.");
    expect(caixa(3)).not.toBeChecked();
    expect(caixa(5)).toBeChecked();
  });

  it("'Marcar todas' e 'Desmarcar todas' funcionam, e o contador acompanha", async () => {
    await conferirComLinhas();
    const contador = screen.getByTestId("contador-de-convites");

    fireEvent.click(screen.getByText("Marcar todas"));
    for (const c of screen.getAllByRole("checkbox")) expect(c).toBeChecked();
    expect(contador).toHaveTextContent("4 convites por e-mail vão sair.");

    fireEvent.click(screen.getByText("Desmarcar todas"));
    for (const c of screen.getAllByRole("checkbox")) expect(c).not.toBeChecked();
    expect(contador).toHaveTextContent("Nenhum convite por e-mail vai sair.");
  });

  it("com erro na conferência, não há lista nem caixa", async () => {
    conferirPlanilha.mockResolvedValue({
      ...QUATRO_VALIDAS,
      validas: 3,
      erros: [{ linha: 4, coluna: "email", mensagem: "E-mail inválido." }],
    });
    escolherArquivo();
    fireEvent.click(screen.getByText("Conferir"));
    await screen.findByText(/Linha 4/);

    // Com erro nada é importado: marcar caixas seria trabalho perdido.
    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
    expect(screen.queryByText("Marcar todas")).not.toBeInTheDocument();
  });

  it("trocar o arquivo apaga as marcas junto com o relatório", async () => {
    await conferirComLinhas();
    fireEvent.click(caixa(3));

    fireEvent.change(screen.getByLabelText("Arquivo CSV"), {
      target: { files: [csv("outro.csv")] },
    });
    await waitFor(() =>
      expect(screen.queryAllByRole("checkbox")).toHaveLength(0),
    );

    // Conferido de novo, a linha 3 do arquivo novo começa desmarcada.
    fireEvent.click(screen.getByText("Conferir"));
    await screen.findByText(/Nenhum problema/);
    expect(caixa(3)).not.toBeChecked();
  });
});

describe("SPEC-083/AC-017 — o envio leva só as marcadas no campo `convidar`", () => {
  it("marcadas 3 e 5: `importarPlanilha` recebe [3, 5]", async () => {
    await conferirComLinhas();
    // Fora de ordem de propósito: o campo sai ordenado.
    fireEvent.click(caixa(5));
    fireEvent.click(caixa(3));
    fireEvent.click(screen.getByText("Importar"));

    await waitFor(() => expect(importarPlanilha).toHaveBeenCalledTimes(1));
    const [arquivo, convidar] = importarPlanilha.mock.calls[0];
    expect(arquivo).toBeInstanceOf(File);
    expect(convidar).toEqual([3, 5]);
  });

  it("ninguém marcado: `convidar` vazio, todas com senha como antes", async () => {
    await conferirComLinhas();
    fireEvent.click(screen.getByText("Importar"));

    await waitFor(() => expect(importarPlanilha).toHaveBeenCalledTimes(1));
    expect(importarPlanilha.mock.calls[0][1]).toEqual([]);
  });

  it("marcar todas e desmarcar uma: vão as outras três", async () => {
    await conferirComLinhas();
    fireEvent.click(screen.getByText("Marcar todas"));
    fireEvent.click(caixa(4));
    fireEvent.click(screen.getByText("Importar"));

    await waitFor(() => expect(importarPlanilha).toHaveBeenCalledTimes(1));
    expect(importarPlanilha.mock.calls[0][1]).toEqual([2, 3, 5]);
  });
});

/**
 * A metade do AC-017 que o mock do componente não alcança: **o que vai no
 * multipart**. Usa a `importarPlanilha` REAL, com o `fetch` simulado.
 */
describe("SPEC-083/AC-017 — o multipart", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  async function corpoEnviado(convidar?: number[]): Promise<FormData> {
    const real =
      await vi.importActual<typeof import("@/lib/api-client")>(
        "@/lib/api-client",
      );
    const resposta = {
      ok: true,
      status: 200,
      json: () => Promise.resolve({ criados: [] }),
      clone: () => resposta,
    };
    const fetchMock = vi.fn().mockResolvedValue(resposta);
    vi.stubGlobal("fetch", fetchMock);
    await real.importarPlanilha(csv(), convidar);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    // Importar, e não conferir: `convidar` é ignorado com `conferir=true`.
    expect(url).toMatch(/\/students\/importar$/);
    return init.body as FormData;
  }

  it("`convidar` vai como `3,5`, ao lado do arquivo", async () => {
    const corpo = await corpoEnviado([3, 5]);
    expect(corpo.get("convidar")).toBe("3,5");
    expect(corpo.get("arquivo")).toBeInstanceOf(File);
  });

  it("sem ninguém marcado, o campo nem vai (a requisição de antes)", async () => {
    const vazio = await corpoEnviado([]);
    expect(vazio.has("convidar")).toBe(false);
    expect(vazio.get("arquivo")).toBeInstanceOf(File);
    vi.unstubAllGlobals();
    const semArgumento = await corpoEnviado();
    expect(semArgumento.has("convidar")).toBe(false);
  });
});

describe("SPEC-083/AC-019 — o resultado por linha", () => {
  async function importarCom(criados: unknown[]) {
    importarPlanilha.mockResolvedValue({ criados });
    await conferirComLinhas();
    fireEvent.click(screen.getByText("Importar"));
    await screen.findByText(/importado/);
  }

  it("convidada mostra `convite enviado`; não convidada mostra a senha", async () => {
    await importarCom([
      { linha: 2, alunoId: "a-2", email: "p2@x.com", senhaTemporaria: "pck-AB12" },
      { linha: 3, alunoId: "a-3", email: "p3@x.com", convite: { email: "enviado" } },
    ]);

    expect(screen.getByText(/2 alunos importados/)).toBeInTheDocument();
    expect(screen.getByText(/p2@x.com · pck-AB12/)).toBeInTheDocument();
    const convites = screen.getByRole("list", { name: "Convites por e-mail" });
    const item = within(convites).getByText(/p3@x.com/).closest("li")!;
    expect(item.textContent).toMatch(/convite\s+enviado/);
    // A linha convidada não tem senha nenhuma na tela.
    expect(convites.textContent).not.toMatch(/pck-/);
  });

  it("**`falhou` mostra o motivo e o caminho**: a ficha, para reenviar ou gerar senha", async () => {
    await importarCom([
      {
        linha: 3,
        alunoId: "a-3",
        email: "p3@x.com",
        convite: { email: "falhou", motivo: "cota" },
      },
    ]);

    const convites = screen.getByRole("list", { name: "Convites por e-mail" });
    const item = within(convites).getByText(/p3@x.com/).closest("li")!;
    expect(item.textContent).toContain("falhou");
    expect(item.textContent).toContain("o limite diário de e-mails foi atingido");
    expect(item.textContent).toMatch(
      /reenvie o convite ou gere uma senha\s+temporária/,
    );
    const link = within(item).getByRole("link", { name: "ficha do aluno" });
    expect(link).toHaveAttribute("href", "/pessoas/alunos/a-3");
  });

  it("só convidados: **sem o aviso das senhas**, porque não há senha", async () => {
    await importarCom([
      { linha: 2, alunoId: "a-2", email: "p2@x.com", convite: { email: "enviado" } },
      { linha: 3, alunoId: "a-3", email: "p3@x.com", convite: { email: "falhou" } },
    ]);

    expect(screen.queryByText(/aparecem uma única vez/)).not.toBeInTheDocument();
    const convites = screen.getByRole("list", { name: "Convites por e-mail" });
    expect(within(convites).getAllByRole("listitem")).toHaveLength(2);
  });
});
