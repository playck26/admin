import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CreateCourtForm } from "./create-court-form";

/**
 * SPEC-057/TASK-005/D19/AC-031 — criar quadra **sem escolher cor** manda o
 * corpo de antes da task (o banco aplica o padrão); escolhendo, manda a cor.
 */

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn(), refresh: vi.fn() }),
}));

const api = vi.hoisted(() => ({ createCourt: vi.fn(), listarCatalogo: vi.fn() }));

vi.mock("@/lib/api-client", async () => {
  const real =
    await vi.importActual<typeof import("@/lib/api-client")>("@/lib/api-client");
  return { ...real, createCourt: api.createCourt };
});

// O seletor de catálogo busca opções por conta própria; aqui basta um campo
// que devolva o id escolhido.
vi.mock("@/components/seletor-de-catalogo", () => ({
  SeletorDeCatalogo: ({
    id,
    rotulo,
    onChange,
  }: {
    id: string;
    rotulo: string;
    onChange: (v: string) => void;
  }) => (
    <label>
      {rotulo}
      <input id={id} onChange={(e) => onChange(e.target.value)} />
    </label>
  ),
}));

afterEach(cleanup);
beforeEach(() => {
  vi.resetAllMocks();
  api.createCourt.mockResolvedValue({});
});

function preencher() {
  fireEvent.change(screen.getByLabelText("Nome"), { target: { value: "Nova" } });
  fireEvent.change(screen.getByLabelText("Esporte"), { target: { value: "e-1" } });
  fireEvent.change(screen.getByLabelText("Preço por hora (R$)"), {
    target: { value: "80" },
  });
}

describe("CreateCourtForm — cor da agenda (D19)", () => {
  it("sem escolher cor, o corpo NÃO leva o campo", async () => {
    render(<CreateCourtForm />);
    preencher();

    fireEvent.click(screen.getByRole("button", { name: "Criar quadra" }));

    await waitFor(() => expect(api.createCourt).toHaveBeenCalledTimes(1));
    expect(api.createCourt.mock.calls[0][0]).not.toHaveProperty("cor");
  });

  it("escolhendo, manda a cor da paleta", async () => {
    render(<CreateCourtForm />);
    preencher();
    fireEvent.click(screen.getByRole("radio", { name: "Mostarda" }));

    fireEvent.click(screen.getByRole("button", { name: "Criar quadra" }));

    await waitFor(() => expect(api.createCourt).toHaveBeenCalledTimes(1));
    expect(api.createCourt.mock.calls[0][0]).toMatchObject({ cor: "#8B5E00" });
  });
});
