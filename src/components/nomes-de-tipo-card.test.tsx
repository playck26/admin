import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NomesDeTipoCard } from "./nomes-de-tipo-card";

/**
 * SPEC-054/D1, D12 — **os nomes que o aluno lê** para Quadra e Aula particular.
 * O gestor dá nome; não inventa regra. Campo vazio é o nome padrão (`null`).
 */

const lerNomesDeTipo = vi.hoisted(() => vi.fn());
const definirNomesDeTipo = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api-client", async () => {
  const real =
    await vi.importActual<typeof import("@/lib/api-client")>("@/lib/api-client");
  return { ...real, lerNomesDeTipo, definirNomesDeTipo };
});

beforeEach(() => {
  lerNomesDeTipo.mockReset();
  definirNomesDeTipo.mockReset();
});

describe("NomesDeTipoCard — SPEC-054/D12", () => {
  it("mostra os nomes gravados e salva os DOIS, com vazio virando o padrão (null)", async () => {
    lerNomesDeTipo.mockResolvedValue({
      nomeTipoQuadra: "Espaço",
      nomeTipoAula: "Aula particular",
    });
    definirNomesDeTipo.mockResolvedValue({});
    render(<NomesDeTipoCard />);

    const quadra = await screen.findByLabelText("Nome para Quadra");
    expect(quadra).toHaveValue("Espaço");
    // O padrão não é gravado como texto: aparece como sugestão.
    expect(screen.getByLabelText("Nome para Aula particular")).toHaveValue("");

    fireEvent.change(quadra, { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar nomes" }));

    await waitFor(() =>
      expect(definirNomesDeTipo).toHaveBeenCalledWith({
        nomeTipoQuadra: null,
        nomeTipoAula: null,
      }),
    );
  });

  it("apara espaço nas pontas antes de enviar (o servidor recusa o nome com espaço)", async () => {
    lerNomesDeTipo.mockResolvedValue({
      nomeTipoQuadra: "Quadra",
      nomeTipoAula: "Aula particular",
    });
    definirNomesDeTipo.mockResolvedValue({});
    render(<NomesDeTipoCard />);
    fireEvent.change(await screen.findByLabelText("Nome para Quadra"), {
      target: { value: "  Espaço  " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar nomes" }));
    await waitFor(() =>
      expect(definirNomesDeTipo).toHaveBeenCalledWith({
        nomeTipoQuadra: "Espaço",
        nomeTipoAula: null,
      }),
    );
  });
});
