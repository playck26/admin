import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api-client";
import { EditStudentForm } from "./edit-student-form";

/**
 * DEF-027 — **o botão de desligar aluno, que não existia.**
 *
 * O Admin tem "Inativar" para turma, quadra, professor e plano. Para ALUNO,
 * nenhum — e é exatamente o gesto que o back manda usar: recusar o vínculo de
 * um aluno já aprovado responde *"Aluno já aprovado não é recusado por este
 * fluxo — use inativação (status)"*. O gestor era mandado para uma porta que a
 * tela não abria.
 *
 * **E o back passou a poder recusar.** Com horário futuro marcado, desligar
 * responde `409 ALUNO_COM_COMPROMISSOS` dizendo **quantos são** e que cancelar
 * devolve o crédito. Se a tela trocar isso por "não foi possível", o gestor
 * fica sabendo menos que a resposta — que foi o DEF-025 inteiro.
 */
const getStudent = vi.hoisted(() => vi.fn());
const updateStudent = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api-client", async () => {
  const real =
    await vi.importActual<typeof import("@/lib/api-client")>(
      "@/lib/api-client",
    );
  return {
    ...real,
    getStudent,
    updateStudent,
    listLevels: vi.fn().mockResolvedValue([]),
    regenerarSenhaTemporaria: vi.fn(),
  };
});

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

function aluno(status: "ativo" | "inativo") {
  return {
    id: "a-1",
    nome: "Fulano",
    email: "fulano@x.com",
    telefone: null,
    nivelId: null,
    status,
    vinculo: "aprovado",
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  getStudent.mockResolvedValue(aluno("ativo"));
});

describe("DEF-027 — desligar e reativar o aluno", () => {
  it("o botão existe, e diz DESLIGAR quando o aluno está ativo", async () => {
    render(<EditStudentForm id="a-1" />);
    expect(await screen.findByText("Desligar aluno")).toBeInTheDocument();
  });

  it("desligar chama a rota com `status: inativo`", async () => {
    updateStudent.mockResolvedValue(aluno("inativo"));
    render(<EditStudentForm id="a-1" />);

    fireEvent.click(await screen.findByText("Desligar aluno"));

    await waitFor(() =>
      expect(updateStudent).toHaveBeenCalledWith("a-1", { status: "inativo" }),
    );
  });

  it("e o botão vira REATIVAR sem recarregar a página", async () => {
    updateStudent.mockResolvedValue(aluno("inativo"));
    render(<EditStudentForm id="a-1" />);

    fireEvent.click(await screen.findByText("Desligar aluno"));

    // A resposta do `PATCH` é a ficha atualizada. Sem usá-la, o gestor
    // clicaria de novo achando que não pegou.
    expect(await screen.findByText("Reativar aluno")).toBeInTheDocument();
  });

  it("**a recusa do `409` aparece INTEIRA, com a contagem**", async () => {
    updateStudent.mockRejectedValue(
      new ApiError(
        409,
        "Este aluno tem 3 horarios marcados daqui para frente. Cancele antes de desligá-lo — cancelar devolve o crédito.",
        undefined,
        "ALUNO_COM_COMPROMISSOS",
      ),
    );
    render(<EditStudentForm id="a-1" />);

    fireEvent.click(await screen.findByText("Desligar aluno"));

    // **A contagem é a metade que importa.** "Não foi possível desligar" faria
    // o gestor procurar na agenda dia a dia sem saber se procura uma reserva
    // ou trinta.
    const alerta = await screen.findByRole("alert");
    expect(alerta.textContent).toContain("3 horarios marcados");
    expect(alerta.textContent).toContain("devolve o crédito");
  });

  it("o aluno continua ATIVO na tela depois da recusa", async () => {
    updateStudent.mockRejectedValue(
      new ApiError(409, "Tem compromisso.", undefined, "ALUNO_COM_COMPROMISSOS"),
    );
    render(<EditStudentForm id="a-1" />);

    fireEvent.click(await screen.findByText("Desligar aluno"));
    await screen.findByRole("alert");

    // Trocar o rótulo antes de a resposta chegar (optimistic) mostraria
    // "Reativar" para um aluno que continua ativo — meia inativação na tela,
    // que é a mesma doença que o back acabou de fechar.
    expect(screen.getByText("Desligar aluno")).toBeInTheDocument();
  });

  it("com o aluno DESLIGADO, o texto explica o que ele não pode mais", async () => {
    getStudent.mockResolvedValue(aluno("inativo"));
    render(<EditStudentForm id="a-1" />);

    expect(await screen.findByText("Reativar aluno")).toBeInTheDocument();
    expect(
      screen.getByText(/não entra no app e não pode ser matriculado/i),
    ).toBeInTheDocument();
  });
});
