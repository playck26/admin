import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api-client";
import { CourtManager } from "./court-manager";

/**
 * SPEC-057/TASK-005/D19 — **a cor e o código na ficha da quadra.** O arquivo
 * é separado do `court-manager.test.tsx` porque aquele é sobre reserva, e o
 * `updateCourt` lá é um duble sem nome.
 */

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/quadras",
}));

const api = vi.hoisted(() => ({
  getCourt: vi.fn(),
  listTeachers: vi.fn(),
  updateCourt: vi.fn(),
}));

vi.mock("@/lib/api-client", async () => {
  const real =
    await vi.importActual<typeof import("@/lib/api-client")>("@/lib/api-client");
  return { ...real, ...api };
});

const QUADRA = {
  id: "q-1",
  companyId: "c-1",
  nome: "Quadra 2",
  esporte: { id: "e-1", nome: "Tênis" },
  categoria: null,
  precoHora: 100,
  status: "ativa",
  createdAt: "2026-09-01T00:00:00.000Z",
  imagemUrl: null,
  cor: "#31658C",
  codigoAgenda: "7",
};

afterEach(cleanup);
beforeEach(() => {
  vi.resetAllMocks();
  api.getCourt.mockResolvedValue(QUADRA);
  api.listTeachers.mockResolvedValue({ data: [], total: 0 });
  api.updateCourt.mockResolvedValue(QUADRA);
});

describe("CourtManager — cor e código da quadra (D19)", () => {
  it("mostra o código, que não é campo editável, e a cor atual marcada", async () => {
    render(<CourtManager id="q-1" />);

    expect(await screen.findByText("Q-7")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Azul" })).toBeChecked();
    expect(screen.queryByLabelText(/código/i)).toBeNull();
  });

  it("salvar manda a cor escolhida junto dos outros campos", async () => {
    render(<CourtManager id="q-1" />);

    fireEvent.click(await screen.findByRole("radio", { name: "Vinho" }));
    fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));

    await waitFor(() => expect(api.updateCourt).toHaveBeenCalledTimes(1));
    const [id, corpo] = api.updateCourt.mock.calls[0] as [string, Record<string, unknown>];
    expect(id).toBe("q-1");
    expect(corpo.cor).toBe("#A12B65");
    expect(corpo).not.toHaveProperty("codigoAgenda");
  });

  it("400 COR_QUADRA_INVALIDA do servidor aparece na tela", async () => {
    api.updateCourt.mockRejectedValue(
      new ApiError(400, "Escolha uma das seis cores da paleta da agenda.", undefined, "COR_QUADRA_INVALIDA"),
    );
    render(<CourtManager id="q-1" />);

    await screen.findByText("Q-7");
    fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Escolha uma das seis cores",
    );
  });
});
