import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { exportarAlunos } from "@/lib/api-client";
import { AVISO_DA_EXPORTACAO, ExportarAlunos } from "./exportar-alunos";

/**
 * SPEC-092/AC-007 — o botão "Exportar alunos" baixa o arquivo com o nome da D6
 * e mostra a frase da D7.
 *
 * O `fetch` é o dublê, e o `api-client` é o de verdade: a prova passa pela
 * leitura do `Content-Disposition` e pelo Blob, que é onde o nome e o BOM se
 * perderiam.
 */

/** O que o Back responde (formato da SPEC-092/D1), em bytes. */
const BOM = [0xef, 0xbb, 0xbf];
const CORPO = new Uint8Array([
  ...BOM,
  ...new TextEncoder().encode(
    "Nome;E-mail;Telefone;Nível;Turma 1;Turma 2;Turma 3;Status\r\nAna;ana@x.com;;Iniciante;;;;ativo\r\n",
  ),
]);

function respostaDoBack(cabecalhos: Record<string, string>): Response {
  return new Response(CORPO, { status: 200, headers: cabecalhos });
}

describe("SPEC-092/AC-007 — Exportar alunos", () => {
  let blobs: Blob[];
  let baixados: string[];
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    window.localStorage.setItem("playck_admin_access_token", "token");
    blobs = [];
    baixados = [];
    vi.spyOn(URL, "createObjectURL").mockImplementation((b) => {
      blobs.push(b as Blob);
      return "blob:exportacao";
    });
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(
      function (this: HTMLAnchorElement) {
        baixados.push(this.download);
      },
    );
    fetchMock = vi.fn().mockResolvedValue(
      respostaDoBack({
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="alunos-2026-10-29.csv"',
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    window.localStorage.clear();
  });

  it("mostra a frase da D7 antes de qualquer clique", () => {
    render(<ExportarAlunos />);
    expect(screen.getByText(AVISO_DA_EXPORTACAO)).toBeInTheDocument();
    expect(AVISO_DA_EXPORTACAO).toMatch(/não atualiza alunos/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("baixa com o nome da D6, com os bytes do Back (BOM incluído)", async () => {
    render(<ExportarAlunos />);
    fireEvent.click(screen.getByRole("button", { name: "Exportar alunos" }));

    await waitFor(() => expect(baixados).toEqual(["alunos-2026-10-29.csv"]));
    expect(blobs).toHaveLength(1);
    const bytes = new Uint8Array(await blobs[0].arrayBuffer());
    expect([...bytes]).toEqual([...CORPO]);

    // A rota da SPEC-092, com o token do gestor.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(/\/api\/v1\/students\/exportar$/);
    expect((init.headers as Record<string, string>).Authorization).toBe(
      "Bearer token",
    );
  });

  it("sem Content-Disposition legível, o nome sai pela mesma regra (fuso do clube)", async () => {
    fetchMock.mockResolvedValue(
      respostaDoBack({ "Content-Type": "text/csv; charset=utf-8" }),
    );
    // 23h30 de 29/10 em São Paulo já é 30/10 em UTC.
    const { nomeDoArquivo } = await exportarAlunos(
      new Date("2026-10-30T02:30:00Z"),
    );
    expect(nomeDoArquivo).toBe("alunos-2026-10-29.csv");
  });

  it("o erro do Back aparece na tela, e nada é baixado", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ message: "Falhou aqui." }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }),
    );
    render(<ExportarAlunos />);
    fireEvent.click(screen.getByRole("button", { name: "Exportar alunos" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Falhou aqui.");
    expect(baixados).toEqual([]);
  });
});
