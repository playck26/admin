import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { StudentsList } from "./students-list";

const ALUNO = {
  id: "a1",
  nome: "Aluno Teste",
  email: "aluno@x.com",
  telefone: null,
  nivelId: null,
  status: "ativo",
};

function paginado(data: unknown[]) {
  return { ok: true, json: async () => ({ data, page: 1, pageSize: 20, total: data.length }) };
}

/**
 * O mock responde por rota, e não uma resposta única para tudo: a tela faz
 * duas chamadas diferentes (listagem e fila de pendentes, SPEC-009) e um
 * mock cego devolveria o mesmo aluno nas duas, escondendo justamente o que
 * o teste deveria distinguir.
 */
function mockRotas(pendentes: unknown[], alunos: unknown[] = [ALUNO]) {
  (fetch as unknown as ReturnType<typeof vi.fn>).mockImplementation(
    (url: string) =>
      Promise.resolve(
        String(url).includes("vinculo=pendente")
          ? paginado(pendentes)
          : paginado(alunos),
      ),
  );
}

describe("StudentsList", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  it("mostra os alunos retornados pela API", async () => {
    mockRotas([]);

    render(<StudentsList />);

    expect(await screen.findByText("Aluno Teste")).toBeInTheDocument();
    expect(screen.getByText("Ativo")).toBeInTheDocument();
  });

  it("mostra estado vazio quando não há alunos", async () => {
    mockRotas([], []);

    render(<StudentsList />);

    await waitFor(() =>
      expect(screen.getByText("Nenhum aluno cadastrado ainda.")).toBeInTheDocument(),
    );
  });

  // SPEC-009/REQ-008: quem se auto-cadastra fica numa fila até um admin
  // decidir. A fila só aparece quando há alguém nela.
  it("não mostra a fila de aprovação quando não há pendentes", async () => {
    mockRotas([]);

    render(<StudentsList />);

    await screen.findByText("Aluno Teste");
    expect(screen.queryByText(/aguardando aprovação/i)).not.toBeInTheDocument();
  });

  it("lista cadastros pendentes e aprova (AC-015)", async () => {
    mockRotas([{ ...ALUNO, id: "p1", nome: "Pessoa Pendente", email: "p@x.com" }]);

    render(<StudentsList />);

    expect(
      await screen.findByText(/Cadastros aguardando aprovação \(1\)/),
    ).toBeInTheDocument();
    expect(screen.getByText("Pessoa Pendente")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Aprovar" }));

    await waitFor(() => {
      const chamadas = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls;
      expect(
        chamadas.some(([url]) => String(url).includes("/students/p1/aprovar")),
      ).toBe(true);
    });
  });
});
