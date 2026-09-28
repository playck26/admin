import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CreateClassForm } from "./create-class-form";

/**
 * SPEC-079/AC-005 — **toda turma tem nível** (decisão do Israel de
 * 2026-09-28). O seletor de nível não oferece mais "Sem nível", abre no
 * PRIMEIRO nível do clube — a ordem do servidor, INV-075c: menor `ordem`,
 * depois `createdAt`, depois `id` — e o pedido sempre leva o `nivelId`.
 *
 * D5: clube sem nível nenhum deixa o seletor desabilitado com "Nenhum nível
 * cadastrado" e o envio bloqueado, em vez de mandar uma turma que o Back
 * recusa.
 */

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn(), refresh: vi.fn() }),
}));

const api = vi.hoisted(() => ({
  createClass: vi.fn(),
  listLevels: vi.fn(),
}));

vi.mock("@/lib/api-client", async () => {
  const real =
    await vi.importActual<typeof import("@/lib/api-client")>("@/lib/api-client");
  return {
    ...real,
    createClass: api.createClass,
    listLevels: api.listLevels,
    listCourts: vi
      .fn()
      .mockResolvedValue({ data: [{ id: "q-1", nome: "Quadra 1" }], total: 1 }),
    listTeachers: vi.fn().mockResolvedValue({ data: [], total: 0 }),
  };
});

const nivel = (id: string, nome: string, ordem: number, createdAt: string) => ({
  id,
  companyId: "c-1",
  nome,
  ordem,
  createdAt,
});

/**
 * Fora de ordem de propósito, e com empate de `ordem`: o primeiro da LISTA
 * (Intermediário) não é o primeiro do clube, e entre os dois de `ordem` 0
 * decide o `createdAt` — Avançado é o mais antigo.
 */
const NIVEIS = [
  nivel("n-int", "Intermediário", 1, "2026-01-01T00:00:00.000Z"),
  nivel("n-ini", "Iniciante", 0, "2026-03-01T00:00:00.000Z"),
  nivel("n-ava", "Avançado", 0, "2026-02-01T00:00:00.000Z"),
];

beforeEach(() => {
  api.createClass.mockResolvedValue({ id: "t-nova" });
  api.listLevels.mockResolvedValue(NIVEIS);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

async function escolherQuadra() {
  fireEvent.click(await screen.findByLabelText("Quadra"));
  fireEvent.click(await screen.findByRole("option", { name: "Quadra 1" }));
}

describe("SPEC-079/AC-005 — criar turma: nível obrigatório, o primeiro já escolhido", () => {
  it("abre no primeiro nível pela INV-075c, e o pedido leva esse `nivelId`", async () => {
    render(<CreateClassForm />);
    await waitFor(() =>
      expect(screen.getByLabelText("Nível")).toHaveTextContent("Avançado"),
    );
    await escolherQuadra();

    fireEvent.click(screen.getByRole("button", { name: "Criar turma" }));

    await waitFor(() => expect(api.createClass).toHaveBeenCalledTimes(1));
    expect(api.createClass.mock.calls[0][0]).toMatchObject({
      quadraId: "q-1",
      nivelId: "n-ava",
    });
  });

  it('não oferece "Sem nível": as opções são só os níveis do clube', async () => {
    render(<CreateClassForm />);
    await waitFor(() =>
      expect(screen.getByLabelText("Nível")).toHaveTextContent("Avançado"),
    );

    fireEvent.click(screen.getByLabelText("Nível"));

    const opcoes = await screen.findAllByRole("option");
    expect(opcoes.map((o) => o.textContent)).toEqual([
      "Intermediário",
      "Iniciante",
      "Avançado",
    ]);
    expect(screen.queryByText("Sem nível")).toBeNull();
  });

  it("outro nível escolhido é o que vai no pedido", async () => {
    render(<CreateClassForm />);
    await waitFor(() =>
      expect(screen.getByLabelText("Nível")).toHaveTextContent("Avançado"),
    );
    fireEvent.click(screen.getByLabelText("Nível"));
    fireEvent.click(await screen.findByRole("option", { name: "Intermediário" }));
    await escolherQuadra();

    fireEvent.click(screen.getByRole("button", { name: "Criar turma" }));

    await waitFor(() => expect(api.createClass).toHaveBeenCalledTimes(1));
    expect(api.createClass.mock.calls[0][0]).toMatchObject({ nivelId: "n-int" });
  });

  it('clube sem nível: seletor desabilitado com "Nenhum nível cadastrado", e o envio bloqueado (D5)', async () => {
    api.listLevels.mockResolvedValue([]);
    render(<CreateClassForm />);

    await waitFor(() =>
      expect(screen.getByLabelText("Nível")).toHaveTextContent(
        "Nenhum nível cadastrado",
      ),
    );
    expect(screen.getByLabelText("Nível")).toBeDisabled();
    await escolherQuadra();

    const criar = screen.getByRole("button", { name: "Criar turma" });
    expect(criar).toBeDisabled();
    fireEvent.click(criar);
    expect(api.createClass).not.toHaveBeenCalled();
  });
});
