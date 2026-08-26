import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ImagemDaQuadraSection } from "./imagem-da-quadra-section";
import { ErroDeCompressao } from "@/lib/comprimir-imagem";

/**
 * SPEC-018/TASK-005 — as provas da tela de imagem de quadra.
 *
 * **O que este arquivo guarda, e o da logo não guardava, é a confirmação.**
 * A AC-009 pede texto de produto, e a AC-008 pede que trocar exija afirmar
 * de novo. As duas são fáceis de quebrar sem que nada fique vermelho: a
 * primeira vira um `confirm()` "porque é mais rápido", a segunda some quando
 * alguém tira o reset do estado achando que é detalhe de UI.
 *
 * **A caixa não é o gate — o servidor é** (AC-007). O que estes testes
 * provam é que a tela não deixa a pessoa gastar um upload para descobrir
 * isso, e que ela **lê** o que está afirmando.
 */

const comprimirImagem = vi.hoisted(() => vi.fn());
const enviarImagemDeQuadra = vi.hoisted(() => vi.fn());
const removerImagemDeQuadra = vi.hoisted(() => vi.fn());

vi.mock("@/lib/comprimir-imagem", async () => {
  const real = await vi.importActual<typeof import("@/lib/comprimir-imagem")>(
    "@/lib/comprimir-imagem",
  );
  // `ErroDeCompressao` e as constantes vêm do módulo REAL: o componente faz
  // `instanceof`, e uma classe dublê passaria no teste e falharia no ar.
  return { ...real, comprimirImagem };
});

vi.mock("@/lib/api-client", () => ({
  enviarImagemDeQuadra,
  removerImagemDeQuadra,
}));

const QUADRA = "44444444-4444-4444-8444-444000180014";

const ORIGINAL = new File([new Uint8Array(4 * 1024 * 1024)], "quadra.jpg", {
  type: "image/jpeg",
});
const COMPRIMIDA = new File([new Uint8Array(90 * 1024)], "quadra.webp", {
  type: "image/webp",
});

beforeEach(() => {
  vi.clearAllMocks();
  comprimirImagem.mockResolvedValue({
    arquivo: COMPRIMIDA,
    largura: 2000,
    altura: 1333,
    bytesOriginais: ORIGINAL.size,
    bytesFinais: COMPRIMIDA.size,
  });
  enviarImagemDeQuadra.mockResolvedValue({
    imagemUrl: "https://cdn.exemplo/nova.webp",
  });
  removerImagemDeQuadra.mockResolvedValue({ imagemUrl: null });
});

const caixa = () => screen.getByRole("checkbox");
const botaoEnviar = () =>
  screen.getByRole("button", { name: /Adicionar imagem|Trocar imagem/ });
const escolherArquivo = () => {
  const entrada = screen.getByLabelText("Escolher imagem da quadra");
  fireEvent.change(entrada, { target: { files: [ORIGINAL] } });
};

describe("AC-009 — a afirmação é texto do produto, e diz o que precisa dizer", () => {
  it("avisa que a imagem é pública e permanente, ANTES do envio", () => {
    render(<ImagemDaQuadraSection quadraId={QUADRA} imagemInicial={null} />);
    // Sem isto a afirmação é um cheque em branco: a pessoa confirma sem
    // saber o que está confirmando.
    expect(screen.getByText(/pública e permanente/)).toBeInTheDocument();
  });

  it("diz que não deve mostrar pessoas, e a caixa repete a afirmação", () => {
    render(<ImagemDaQuadraSection quadraId={QUADRA} imagemInicial={null} />);
    expect(screen.getByText(/não de aulas ou de pessoas/)).toBeInTheDocument();
    expect(
      screen.getByText(/não mostra pessoas\s+identificáveis/),
    ).toBeInTheDocument();
  });

  it("é caixa do produto, não `confirm()` do navegador", () => {
    // Um `confirm()` é texto do sistema operacional: não dá para ler com
    // calma, não fica na tela e some ao clicar. A AC-009 pede o contrário.
    const confirmar = vi.spyOn(window, "confirm");
    render(<ImagemDaQuadraSection quadraId={QUADRA} imagemInicial={null} />);
    fireEvent.click(caixa());
    escolherArquivo();
    expect(confirmar).not.toHaveBeenCalled();
    confirmar.mockRestore();
  });
});

describe("AC-007 — sem confirmar, não dá para enviar", () => {
  it("o botão nasce desabilitado, e a tela diz por quê", () => {
    render(<ImagemDaQuadraSection quadraId={QUADRA} imagemInicial={null} />);
    expect(botaoEnviar()).toBeDisabled();
    expect(screen.getByText(/Marque a confirmação/)).toBeInTheDocument();
  });

  it("marcar a caixa habilita o botão e some com o aviso", () => {
    render(<ImagemDaQuadraSection quadraId={QUADRA} imagemInicial={null} />);
    fireEvent.click(caixa());
    expect(botaoEnviar()).toBeEnabled();
    expect(screen.queryByText(/Marque a confirmação/)).not.toBeInTheDocument();
  });

  it("desmarcar volta a desabilitar", () => {
    render(<ImagemDaQuadraSection quadraId={QUADRA} imagemInicial={null} />);
    fireEvent.click(caixa());
    fireEvent.click(caixa());
    expect(botaoEnviar()).toBeDisabled();
  });
});

describe("o envio", () => {
  it("comprime ANTES de enviar, e manda o arquivo COMPRIMIDO", async () => {
    // Na ordem inversa, quem tira foto na quadra sobe 4 MB por uma rede ruim
    // para levar 413 no fim (NFR-001).
    render(<ImagemDaQuadraSection quadraId={QUADRA} imagemInicial={null} />);
    fireEvent.click(caixa());
    escolherArquivo();

    await waitFor(() => expect(enviarImagemDeQuadra).toHaveBeenCalled());
    expect(comprimirImagem).toHaveBeenCalledWith(ORIGINAL);

    // **`toHaveBeenCalledWith(COMPRIMIDA)` NÃO prova isto**, e a descoberta
    // custou uma sabotagem que passou (2026-08-26): `File` e `Blob` não têm
    // propriedade própria enumerável — `name`, `size` e `type` são getters
    // do protótipo. A comparação estrutural do vitest vê `{}` contra `{}`, e
    // considera **qualquer** File igual a qualquer outro.
    //
    // A identidade (`toBe`) é o que separa: só passa se for o mesmo objeto.
    const [id, enviado, confirmou] = enviarImagemDeQuadra.mock.calls[0] as [
      string,
      File,
      boolean,
    ];
    expect(id).toBe(QUADRA);
    expect(enviado).toBe(COMPRIMIDA);
    expect(enviado).not.toBe(ORIGINAL);
    expect(enviado.name).toBe("quadra.webp");
    expect(confirmou).toBe(true);
  });

  it("a confirmação vai como `true` no terceiro argumento", async () => {
    render(<ImagemDaQuadraSection quadraId={QUADRA} imagemInicial={null} />);
    fireEvent.click(caixa());
    escolherArquivo();

    await waitFor(() => expect(enviarImagemDeQuadra).toHaveBeenCalled());
    expect(enviarImagemDeQuadra.mock.calls[0][2]).toBe(true);
  });

  it("manda o estado REAL da caixa, não um `true` fixo", async () => {
    // **Este teste nasceu de uma sabotagem que passou.** Trocar
    // `confirmou` por `true` na chamada deixava os 14 testes verdes, porque
    // todos marcavam a caixa antes de subir — nenhum distinguia o estado
    // real de um literal.
    //
    // O que a sabotagem causaria em produção: um gestor que DESMARCA a caixa
    // e ainda assim consegue disparar o envio (por um bug de estado, ou por
    // qualquer caminho que não passe pelo botão desabilitado) seria gravado
    // no banco como tendo afirmado. A AC-008 registra nome e data — e o nome
    // seria de alguém que disse que não.
    //
    // O envio é disparado pelo `change` do input, sem passar pelo botão: é
    // assim que se pergunta "o que o componente manda quando a caixa está
    // desmarcada?" sem depender do `disabled`, que é a OUTRA defesa.
    render(<ImagemDaQuadraSection quadraId={QUADRA} imagemInicial={null} />);
    escolherArquivo();

    await waitFor(() => expect(enviarImagemDeQuadra).toHaveBeenCalled());
    expect(enviarImagemDeQuadra.mock.calls[0][2]).toBe(false);
  });

  it("a imagem nova aparece na tela", async () => {
    render(<ImagemDaQuadraSection quadraId={QUADRA} imagemInicial={null} />);
    fireEvent.click(caixa());
    escolherArquivo();

    const img = await screen.findByAltText("Imagem da quadra");
    expect(img).toHaveAttribute("src", "https://cdn.exemplo/nova.webp");
  });

  it("AC-008 — depois de enviar, a caixa DESMARCA: trocar exige afirmar de novo", async () => {
    // A confirmação vale para *aquela* imagem, não é licença permanente para
    // a quadra. Se ficasse marcada, a próxima troca herdaria uma afirmação
    // que ninguém fez — e o banco registraria o nome de quem não afirmou.
    render(<ImagemDaQuadraSection quadraId={QUADRA} imagemInicial={null} />);
    fireEvent.click(caixa());
    escolherArquivo();

    await screen.findByAltText("Imagem da quadra");
    expect(caixa()).not.toBeChecked();
    expect(
      screen.getByRole("button", { name: /Trocar imagem/ }),
    ).toBeDisabled();
  });
});

describe("erros e remoção", () => {
  it("o erro de compressão chega à tela com o texto dele", async () => {
    // Texto de produto — trocar por mensagem genérica esconderia justamente
    // o erro que o gestor não causou.
    comprimirImagem.mockRejectedValue(
      new ErroDeCompressao(
        'A imagem gerada não seria aceita pelo servidor (chunk fora da allowlist: "EXIF").',
      ),
    );

    render(<ImagemDaQuadraSection quadraId={QUADRA} imagemInicial={null} />);
    fireEvent.click(caixa());
    escolherArquivo();

    const alerta = await screen.findByRole("alert");
    expect(alerta).toHaveTextContent("EXIF");
    // E nada foi enviado: a compressão recusou antes de gastar a rede.
    expect(enviarImagemDeQuadra).not.toHaveBeenCalled();
  });

  it("o 422 do servidor chega à tela", async () => {
    // O gate de verdade é o servidor. Se a tela deixasse passar (um bug de
    // estado, por exemplo), a mensagem tem de ser legível — e não "erro".
    enviarImagemDeQuadra.mockRejectedValue(
      new Error("Confirme que a imagem não mostra pessoas identificáveis."),
    );

    render(<ImagemDaQuadraSection quadraId={QUADRA} imagemInicial={null} />);
    fireEvent.click(caixa());
    escolherArquivo();

    const alerta = await screen.findByRole("alert");
    expect(alerta).toHaveTextContent(/não mostra pessoas identificáveis/);
  });

  it("AC-010 — remover existe, e some com a imagem", async () => {
    render(
      <ImagemDaQuadraSection
        quadraId={QUADRA}
        imagemInicial="https://cdn.exemplo/antiga.webp"
      />,
    );
    expect(screen.getByAltText("Imagem da quadra")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Remover/ }));

    await waitFor(() =>
      expect(removerImagemDeQuadra).toHaveBeenCalledWith(QUADRA),
    );
    await waitFor(() =>
      expect(screen.queryByAltText("Imagem da quadra")).not.toBeInTheDocument(),
    );
    expect(screen.getByText("Sem imagem")).toBeInTheDocument();
  });

  it("sem imagem, não oferece Remover", () => {
    render(<ImagemDaQuadraSection quadraId={QUADRA} imagemInicial={null} />);
    expect(
      screen.queryByRole("button", { name: /Remover/ }),
    ).not.toBeInTheDocument();
  });
});
