import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ContratoDoClubeCard } from "./contrato-do-clube-card";

/**
 * SPEC-024 — as provas do contrato do lado do gestor.
 *
 * O que elas guardam não é o formulário: é o **aviso**. A decisão do Israel
 * (ADR-017, item 3) faz publicar interromper todo mundo no próximo acesso, e
 * um botão "Publicar" sem esse aviso parece salvar rascunho. A prova de que
 * o número aparece antes da confirmação é a razão deste arquivo existir.
 */

const getContratoDaEmpresa = vi.hoisted(() => vi.fn());
const getAlcanceDoContrato = vi.hoisted(() => vi.fn());
const publicarContrato = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api-client", async () => {
  const real =
    await vi.importActual<typeof import("@/lib/api-client")>(
      "@/lib/api-client",
    );
  return {
    ...real,
    getContratoDaEmpresa,
    getAlcanceDoContrato,
    publicarContrato,
  };
});

beforeEach(() => {
  vi.clearAllMocks();
  getAlcanceDoContrato.mockResolvedValue({ pessoas: 13 });
  publicarContrato.mockImplementation((texto: string) =>
    Promise.resolve({ versao: 2, texto, publicadoEm: new Date().toISOString() }),
  );
});

describe("clube que nunca publicou", () => {
  it("diz isso, em vez de mostrar uma versão que não existe", async () => {
    getContratoDaEmpresa.mockResolvedValue({
      versao: null,
      texto: null,
      publicadoEm: null,
    });
    render(<ContratoDoClubeCard />);

    expect(await screen.findByText("nunca publicado")).toBeInTheDocument();
  });

  it("não deixa publicar texto vazio", async () => {
    getContratoDaEmpresa.mockResolvedValue({
      versao: null,
      texto: null,
      publicadoEm: null,
    });
    render(<ContratoDoClubeCard />);

    expect(
      await screen.findByRole("button", { name: "Publicar contrato" }),
    ).toBeDisabled();
  });
});

describe("o aviso de alcance vem ANTES de publicar", () => {
  it("mostra quantas pessoas terão que reaceitar, com o número", async () => {
    getContratoDaEmpresa.mockResolvedValue({
      versao: 1,
      texto: "Contrato antigo",
      publicadoEm: null,
    });
    render(<ContratoDoClubeCard />);

    fireEvent.change(await screen.findByLabelText("Texto do contrato"), {
      target: { value: "Contrato novo" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Publicar contrato" }));

    expect(
      await screen.findByText(/13 pessoas terão que ler e aceitar/i),
    ).toBeInTheDocument();
    // E ainda NÃO publicou: o aviso é um passo, não um rodapé.
    expect(publicarContrato).not.toHaveBeenCalled();
  });

  it("avisa que não dá para despublicar (LIM-024a)", async () => {
    getContratoDaEmpresa.mockResolvedValue({
      versao: 1,
      texto: "Antigo",
      publicadoEm: null,
    });
    render(<ContratoDoClubeCard />);

    fireEvent.change(await screen.findByLabelText("Texto do contrato"), {
      target: { value: "Novo" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Publicar contrato" }));

    expect(
      await screen.findByText(/Não é possível despublicar/i),
    ).toBeInTheDocument();
  });

  it("confirmar publica, e o botão diz qual versão vai nascer", async () => {
    getContratoDaEmpresa.mockResolvedValue({
      versao: 1,
      texto: "Antigo",
      publicadoEm: null,
    });
    render(<ContratoDoClubeCard />);

    fireEvent.change(await screen.findByLabelText("Texto do contrato"), {
      target: { value: "Novo texto" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Publicar contrato" }));
    fireEvent.click(
      await screen.findByRole("button", { name: "Publicar versão 2" }),
    );

    await waitFor(() =>
      expect(publicarContrato).toHaveBeenCalledWith("Novo texto"),
    );
  });

  it("cancelar não publica", async () => {
    getContratoDaEmpresa.mockResolvedValue({
      versao: 1,
      texto: "Antigo",
      publicadoEm: null,
    });
    render(<ContratoDoClubeCard />);

    fireEvent.change(await screen.findByLabelText("Texto do contrato"), {
      target: { value: "Novo" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Publicar contrato" }));
    fireEvent.click(await screen.findByRole("button", { name: "Cancelar" }));

    expect(publicarContrato).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: "Publicar contrato" }),
    ).toBeInTheDocument();
  });

  it("clube sem aluno ativo ouve isso em vez de 'nenhuma pessoa'", async () => {
    getAlcanceDoContrato.mockResolvedValue({ pessoas: 0 });
    getContratoDaEmpresa.mockResolvedValue({
      versao: null,
      texto: null,
      publicadoEm: null,
    });
    render(<ContratoDoClubeCard />);

    fireEvent.change(await screen.findByLabelText("Texto do contrato"), {
      target: { value: "Primeiro contrato" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Publicar contrato" }));

    expect(
      await screen.findByText("Nenhum aluno ativo será afetado agora."),
    ).toBeInTheDocument();
  });
});

describe("texto igual ao que está no ar", () => {
  it("não deixa republicar o mesmo — seria obrigar todo mundo a reaceitar à toa", async () => {
    getContratoDaEmpresa.mockResolvedValue({
      versao: 2,
      texto: "O mesmo texto",
      publicadoEm: null,
    });
    render(<ContratoDoClubeCard />);

    expect(
      await screen.findByRole("button", { name: "Publicar contrato" }),
    ).toBeDisabled();
    expect(screen.getByText(/Este é o texto que está no ar/i)).toBeInTheDocument();
  });
});
