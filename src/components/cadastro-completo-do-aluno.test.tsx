import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api-client";
import { CadastroCompletoDoAluno } from "./cadastro-completo-do-aluno";

/**
 * SPEC-036/TASK-004 — o cadastro completo na ficha do aluno.
 *
 * **O caso que mais importa é o do `null`.** O servidor recusa `""` com `400`
 * (INV-108: ausência é `NULL`, e só), então um campo que a pessoa esvazia
 * precisa virar `null` no corpo — e não string vazia. Uma tela que mandasse
 * `""` transformaria "apagar" num erro que ninguém entenderia.
 *
 * O segundo é a barra: ela mostra **o que falta**, não só o número. `70%` não
 * diz a ninguém o que fazer.
 */
const getStudent = vi.hoisted(() => vi.fn());
const updateStudent = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api-client", async () => {
  const real =
    await vi.importActual<typeof import("@/lib/api-client")>(
      "@/lib/api-client",
    );
  return { ...real, getStudent, updateStudent };
});

const ALUNO = "a-1";

function ficha(extra: Record<string, unknown> = {}) {
  return {
    id: ALUNO,
    nome: "Ana",
    email: "ana@clube.local",
    telefone: null,
    nivelId: null,
    status: "ativo",
    dataNascimento: null,
    emergenciaNome: null,
    emergenciaTelefone: null,
    endereco: null,
    cidade: null,
    uf: null,
    observacoesSaude: null,
    cadastro: {
      percentual: 29,
      faltam: [
        "telefone",
        "dataNascimento",
        "emergenciaNome",
        "emergenciaTelefone",
        "nivelId",
      ],
    },
    ...extra,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  getStudent.mockResolvedValue(ficha());
  updateStudent.mockResolvedValue(ficha());
});

describe("CadastroCompletoDoAluno", () => {
  it("a barra mostra o percentual E o que falta, em português", async () => {
    render(<CadastroCompletoDoAluno alunoId={ALUNO} />);

    expect(await screen.findByText("29% preenchido")).toBeInTheDocument();
    // Os nomes dos campos saem traduzidos: `emergenciaTelefone` não é uma
    // palavra que o gestor conheça.
    expect(screen.getByText(/telefone de emergência/)).toBeInTheDocument();
    expect(
      screen.getByRole("progressbar", { name: "Completude do cadastro" }),
    ).toHaveAttribute("aria-valuenow", "29");
  });

  it("cadastro em 100% diz isso, e não lista campo nenhum", async () => {
    getStudent.mockResolvedValue(
      ficha({ cadastro: { percentual: 100, faltam: [] } }),
    );
    render(<CadastroCompletoDoAluno alunoId={ALUNO} />);

    expect(await screen.findByText("cadastro completo")).toBeInTheDocument();
    expect(screen.queryByText(/^falta:/)).not.toBeInTheDocument();
  });

  it("campo vazio vira `null`, e NUNCA string vazia", async () => {
    render(<CadastroCompletoDoAluno alunoId={ALUNO} />);
    fireEvent.change(await screen.findByLabelText("Cidade"), {
      target: { value: "Santos" },
    });
    fireEvent.click(screen.getByText("Salvar cadastro"));

    await waitFor(() => expect(updateStudent).toHaveBeenCalled());
    const [, dto] = updateStudent.mock.calls[0] as [
      string,
      Record<string, unknown>,
    ];
    expect(dto.cidade).toBe("Santos");
    // **O servidor recusa `""` com 400** (INV-108). Uma tela que mandasse
    // string vazia transformaria "apagar" num erro sem explicação.
    expect(dto.endereco).toBeNull();
    expect(dto.emergenciaNome).toBeNull();
    expect(dto.uf).toBeNull();
  });

  it("a data mostra a IDADE, e não muda regra nenhuma", async () => {
    getStudent.mockResolvedValue(ficha({ dataNascimento: "2010-01-01" }));
    render(<CadastroCompletoDoAluno alunoId={ALUNO} />);

    // Menor de idade é só informação nesta versão (LIM-036c): nenhum campo
    // novo aparece, nenhum botão desabilita.
    expect(await screen.findByText(/anos\./)).toBeInTheDocument();
    expect(screen.getByText("Salvar cadastro")).not.toBeDisabled();
  });

  it("a UF vem do contrato: `XX` não é oferecida", async () => {
    render(<CadastroCompletoDoAluno alunoId={ALUNO} />);
    fireEvent.click(await screen.findByLabelText("UF"));

    expect(
      await screen.findByRole("option", { name: "SP" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("option", { name: "XX" }),
    ).not.toBeInTheDocument();
  });

  it("`DATA_NASCIMENTO_INVALIDA` vira mensagem por CODE", async () => {
    updateStudent.mockRejectedValue(
      new ApiError(422, "crua", undefined, "DATA_NASCIMENTO_INVALIDA"),
    );
    render(<CadastroCompletoDoAluno alunoId={ALUNO} />);
    fireEvent.click(await screen.findByText("Salvar cadastro"));

    expect(
      await screen.findByText(/posterior a 1900 e não pode estar no futuro/),
    ).toBeInTheDocument();
  });

  it("salvar recarrega a barra a partir da RESPOSTA, não do que foi enviado", async () => {
    updateStudent.mockResolvedValue(
      ficha({
        cidade: "Santos",
        cadastro: { percentual: 43, faltam: ["dataNascimento"] },
      }),
    );
    render(<CadastroCompletoDoAluno alunoId={ALUNO} />);
    fireEvent.click(await screen.findByText("Salvar cadastro"));

    // A completude é calculada no servidor (D2: não há coluna). Recalcular na
    // tela criaria uma segunda fonte para a mesma pergunta, e as duas
    // divergiriam no primeiro campo novo — que a SPEC-037 já vai trazer.
    expect(await screen.findByText("43% preenchido")).toBeInTheDocument();
  });
});
