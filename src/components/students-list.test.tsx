import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { StudentsList } from "./students-list";

describe("StudentsList", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  it("mostra os alunos retornados pela API", async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [{ id: "a1", nome: "Aluno Teste", email: "aluno@x.com", telefone: null, nivelId: null, status: "ativo" }],
        page: 1,
        pageSize: 20,
        total: 1,
      }),
    });

    render(<StudentsList />);

    expect(await screen.findByText("Aluno Teste")).toBeInTheDocument();
    expect(screen.getByText("Ativo")).toBeInTheDocument();
  });

  it("mostra estado vazio quando não há alunos", async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ data: [], page: 1, pageSize: 20, total: 0 }),
    });

    render(<StudentsList />);

    await waitFor(() => expect(screen.getByText("Nenhum aluno cadastrado ainda.")).toBeInTheDocument());
  });
});
