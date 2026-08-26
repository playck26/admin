import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FotoDoProfessor } from "./foto-do-professor";
import { ErroDeCompressao } from "@/lib/comprimir-imagem";

/**
 * SPEC-018/TASK-004 — as provas da foto na ficha do professor.
 *
 * **O que esta tela tem de específico é conviver com a INV-034.** Ela é a
 * única do produto onde um upload pode dar certo e a imagem **não mudar** —
 * porque quem tem conta manda na própria foto. Sem tratamento, isso lê como
 * falha silenciosa, que é o pior desfecho possível: o gestor tenta de novo,
 * com outro arquivo, e continua "não funcionando".
 */

const comprimirImagem = vi.hoisted(() => vi.fn());
const enviarFotoDeProfessor = vi.hoisted(() => vi.fn());
const removerFotoDeProfessor = vi.hoisted(() => vi.fn());

vi.mock("@/lib/comprimir-imagem", async () => {
  const real = await vi.importActual<typeof import("@/lib/comprimir-imagem")>(
    "@/lib/comprimir-imagem",
  );
  // `ErroDeCompressao` e as constantes vêm do módulo REAL: o componente faz
  // `instanceof`, e uma classe dublê passaria no teste e falharia no ar.
  return { ...real, comprimirImagem };
});

vi.mock("@/lib/api-client", () => ({
  enviarFotoDeProfessor,
  removerFotoDeProfessor,
}));

const PROFESSOR = "55555555-5555-4555-8555-555000180025";
const DELE = "https://assinada/perfil/dele";
const DA_FICHA = "https://assinada/professor/da-ficha";

const ORIGINAL = new File([new Uint8Array(4 * 1024 * 1024)], "prof.jpg", {
  type: "image/jpeg",
});
const COMPRIMIDA = new File([new Uint8Array(70 * 1024)], "prof.webp", {
  type: "image/webp",
});

beforeEach(() => {
  vi.clearAllMocks();
  comprimirImagem.mockResolvedValue({
    arquivo: COMPRIMIDA,
    largura: 2000,
    altura: 1500,
    bytesOriginais: ORIGINAL.size,
    bytesFinais: COMPRIMIDA.size,
  });
  enviarFotoDeProfessor.mockResolvedValue({ fotoUrl: DA_FICHA });
  removerFotoDeProfessor.mockResolvedValue({ fotoUrl: null });
});

const escolherArquivo = () => {
  fireEvent.change(screen.getByLabelText("Escolher foto do professor"), {
    target: { files: [ORIGINAL] },
  });
};

describe("o caso normal — professor SEM conta", () => {
  it("comprime ANTES de enviar, e manda o arquivo comprimido", async () => {
    render(
      <FotoDoProfessor
        professorId={PROFESSOR}
        fotoInicial={null}
        temConta={false}
      />,
    );
    escolherArquivo();

    await waitFor(() => expect(enviarFotoDeProfessor).toHaveBeenCalled());
    expect(comprimirImagem).toHaveBeenCalledWith(ORIGINAL);
    // **`toHaveBeenCalledWith(COMPRIMIDA)` NÃO prova isto**, e a descoberta
    // custou uma sabotagem que passou (2026-08-26): `File` e `Blob` não têm
    // propriedade própria enumerável — `name`, `size` e `type` são getters
    // do protótipo. A comparação estrutural do vitest vê `{}` contra `{}`, e
    // considera **qualquer** File igual a qualquer outro.
    //
    // A identidade (`toBe`) é o que separa: só passa se for o mesmo objeto.
    const [id, enviado] = enviarFotoDeProfessor.mock.calls[0] as [string, File];
    expect(id).toBe(PROFESSOR);
    expect(enviado).toBe(COMPRIMIDA);
    expect(enviado).not.toBe(ORIGINAL);
    expect(enviado.name).toBe("prof.webp");
  });

  it("a foto aparece depois de subir", async () => {
    render(
      <FotoDoProfessor
        professorId={PROFESSOR}
        fotoInicial={null}
        temConta={false}
      />,
    );
    escolherArquivo();

    const img = await screen.findByAltText("Foto do professor");
    expect(img).toHaveAttribute("src", DA_FICHA);
  });

  it("NÃO fala de conta para quem não tem", async () => {
    render(
      <FotoDoProfessor
        professorId={PROFESSOR}
        fotoInicial={null}
        temConta={false}
      />,
    );
    expect(screen.queryByText(/tem login/)).not.toBeInTheDocument();
    // E o aviso da precedência não aparece nem depois de subir.
    escolherArquivo();
    await screen.findByAltText("Foto do professor");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("diz que a foto é privada — a diferença que decide o que se sobe", () => {
    render(
      <FotoDoProfessor
        professorId={PROFESSOR}
        fotoInicial={null}
        temConta={false}
      />,
    );
    expect(screen.getByText(/Ela é privada/)).toBeInTheDocument();
  });
});

describe("INV-034 na tela — quando o upload dá certo e nada muda", () => {
  it("avisa quando a foto do professor tem preferência sobre a que subiu", async () => {
    // **O caso que só existe nesta tela.** O gestor sobe, o servidor grava na
    // ficha e devolve a foto DA CONTA, porque é ela que tem preferência. A
    // imagem não muda. Sem o aviso, o gestor conclui que o upload falhou —
    // e tenta de novo, com outro arquivo, para sempre.
    enviarFotoDeProfessor.mockResolvedValue({ fotoUrl: DELE });

    render(
      <FotoDoProfessor
        professorId={PROFESSOR}
        fotoInicial={DELE}
        temConta={true}
      />,
    );
    escolherArquivo();

    const aviso = await screen.findByRole("status");
    expect(aviso).toHaveTextContent(/salva na ficha/);
    expect(aviso).toHaveTextContent(/perfil dele/);
  });

  it("NÃO avisa quando a foto realmente mudou", async () => {
    // Professor com conta, mas sem foto própria: a da ficha é a que aparece,
    // o upload muda a tela, e o aviso seria ruído — pior, sugeriria um
    // problema onde não há.
    enviarFotoDeProfessor.mockResolvedValue({ fotoUrl: DA_FICHA });

    render(
      <FotoDoProfessor
        professorId={PROFESSOR}
        fotoInicial={null}
        temConta={true}
      />,
    );
    escolherArquivo();

    await screen.findByAltText("Foto do professor");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("avisa de antemão que a foto do professor pode substituir a da ficha", () => {
    // Antes de qualquer upload: quem tem login pode trocar a própria imagem
    // depois, e o gestor precisa saber que esta foto não é a palavra final.
    render(
      <FotoDoProfessor
        professorId={PROFESSOR}
        fotoInicial={null}
        temConta={true}
      />,
    );
    expect(screen.getByText(/Este professor tem login/)).toBeInTheDocument();
  });
});

describe("remoção e erro", () => {
  it("AC-010 — remover apaga a da ficha", async () => {
    render(
      <FotoDoProfessor
        professorId={PROFESSOR}
        fotoInicial={DA_FICHA}
        temConta={false}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Remover/ }));

    await waitFor(() =>
      expect(removerFotoDeProfessor).toHaveBeenCalledWith(PROFESSOR),
    );
    await waitFor(() =>
      expect(
        screen.queryByAltText("Foto do professor"),
      ).not.toBeInTheDocument(),
    );
  });

  it("remover NÃO deixa vazio quando a pessoa tem foto própria", async () => {
    // O gestor não apaga a imagem de perfil de ninguém: some a da ficha, e a
    // dele aparece. Por isso a resposta do DELETE é usada, e não descartada.
    removerFotoDeProfessor.mockResolvedValue({ fotoUrl: DELE });

    render(
      <FotoDoProfessor
        professorId={PROFESSOR}
        fotoInicial={DA_FICHA}
        temConta={true}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Remover/ }));

    await waitFor(() =>
      expect(screen.getByAltText("Foto do professor")).toHaveAttribute(
        "src",
        DELE,
      ),
    );
  });

  it("sem foto, não oferece Remover", () => {
    render(
      <FotoDoProfessor
        professorId={PROFESSOR}
        fotoInicial={null}
        temConta={false}
      />,
    );
    expect(
      screen.queryByRole("button", { name: /Remover/ }),
    ).not.toBeInTheDocument();
  });

  it("o erro de compressão chega à tela com o texto dele", async () => {
    comprimirImagem.mockRejectedValue(
      new ErroDeCompressao(
        'A imagem gerada não seria aceita pelo servidor (chunk fora da allowlist: "EXIF").',
      ),
    );

    render(
      <FotoDoProfessor
        professorId={PROFESSOR}
        fotoInicial={null}
        temConta={false}
      />,
    );
    escolherArquivo();

    const alerta = await screen.findByRole("alert");
    expect(alerta).toHaveTextContent("EXIF");
    expect(enviarFotoDeProfessor).not.toHaveBeenCalled();
  });

  it("o 404 do servidor chega legível", async () => {
    enviarFotoDeProfessor.mockRejectedValue(
      new Error("Professor não encontrado."),
    );

    render(
      <FotoDoProfessor
        professorId={PROFESSOR}
        fotoInicial={null}
        temConta={false}
      />,
    );
    escolherArquivo();

    const alerta = await screen.findByRole("alert");
    expect(alerta).toHaveTextContent(/não encontrado/);
  });
});
