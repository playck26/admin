import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api-client";
import { TiposDeAdicionalManager } from "./tipos-de-adicional-manager";

/**
 * SPEC-054/D12 — **a tela dos tipos de adicional** (`/reservas/tipos`):
 * criar, renomear e apagar, com o `TIPO_EM_USO` explicado.
 */

const listarTiposDeAdicional = vi.hoisted(() => vi.fn());
const criarTipoDeAdicional = vi.hoisted(() => vi.fn());
const editarTipoDeAdicional = vi.hoisted(() => vi.fn());
const apagarTipoDeAdicional = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api-client", async () => {
  const real =
    await vi.importActual<typeof import("@/lib/api-client")>("@/lib/api-client");
  return {
    ...real,
    listarTiposDeAdicional,
    criarTipoDeAdicional,
    editarTipoDeAdicional,
    apagarTipoDeAdicional,
  };
});

beforeEach(() => {
  for (const f of [
    listarTiposDeAdicional,
    criarTipoDeAdicional,
    editarTipoDeAdicional,
    apagarTipoDeAdicional,
  ]) {
    f.mockReset();
  }
  listarTiposDeAdicional.mockResolvedValue([
    { id: "t1", nome: "Raquetes", ordem: 0 },
  ]);
});

describe("TiposDeAdicionalManager — SPEC-054/D12", () => {
  it("lista os tipos e cria um novo no fim da ordem", async () => {
    criarTipoDeAdicional.mockResolvedValue({ id: "t2", nome: "Bolas", ordem: 1 });
    render(<TiposDeAdicionalManager />);
    expect(await screen.findByText("Raquetes")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Nome do tipo"), {
      target: { value: "Bolas" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Adicionar" }));

    await waitFor(() =>
      expect(criarTipoDeAdicional).toHaveBeenCalledWith({ nome: "Bolas", ordem: 1 }),
    );
  });

  it("renomear manda só o nome novo", async () => {
    editarTipoDeAdicional.mockResolvedValue({ id: "t1", nome: "Raquetes pro", ordem: 0 });
    render(<TiposDeAdicionalManager />);
    fireEvent.click(await screen.findByRole("button", { name: "Renomear Raquetes" }));
    const campo = screen.getByLabelText("Novo nome de Raquetes");
    fireEvent.change(campo, { target: { value: "Raquetes pro" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar nome" }));
    await waitFor(() =>
      expect(editarTipoDeAdicional).toHaveBeenCalledWith("t1", { nome: "Raquetes pro" }),
    );
  });

  it("apagar tipo em uso mostra QUANTOS adicionais o usam e o que fazer", async () => {
    apagarTipoDeAdicional.mockRejectedValue(
      new ApiError(
        422,
        "Este tipo tem 3 adicional(is) e não pode ser apagado. Mova ou desative os adicionais antes.",
        undefined,
        "TIPO_EM_USO",
      ),
    );
    render(<TiposDeAdicionalManager />);
    fireEvent.click(await screen.findByRole("button", { name: "Apagar Raquetes" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Este tipo tem 3 adicional(is) e não pode ser apagado",
    );
  });
});
