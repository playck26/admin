import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SeletorDeCorDaQuadra } from "./seletor-de-cor-da-quadra";

/**
 * SPEC-057/TASK-005/D19 — **seis amostras rotuladas, e nada além delas.**
 * Sem campo de cor livre e sem transparência: a validação do servidor recusa
 * fora da paleta, e a tela não oferece o que seria recusado.
 */

afterEach(cleanup);

describe("SeletorDeCorDaQuadra (D19)", () => {
  it("oferece exatamente as seis cores, cada uma com nome", () => {
    render(<SeletorDeCorDaQuadra valor="#00763A" onChange={() => {}} />);

    const grupo = screen.getByRole("radiogroup", { name: "Cor na agenda" });
    const opcoes = screen.getAllByRole("radio");
    expect(grupo).toBeInTheDocument();
    expect(opcoes.map((o) => o.getAttribute("aria-label"))).toEqual([
      "Verde",
      "Azul",
      "Telha",
      "Roxo",
      "Mostarda",
      "Vinho",
    ]);
    // Nenhuma entrada livre de cor.
    expect(document.querySelector('input[type="color"]')).toBeNull();
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("marca a atual e devolve o hex canônico da escolhida", () => {
    const onChange = vi.fn();
    render(<SeletorDeCorDaQuadra valor="#31658C" onChange={onChange} />);

    expect(screen.getByRole("radio", { name: "Azul" })).toBeChecked();
    fireEvent.click(screen.getByRole("radio", { name: "Vinho" }));
    expect(onChange).toHaveBeenCalledWith("#A12B65");
  });

  it("sem valor, nenhuma marcada — o create omite a cor e o banco usa o padrão", () => {
    render(<SeletorDeCorDaQuadra valor="" onChange={() => {}} />);

    expect(screen.getAllByRole("radio").some((r) => (r as HTMLInputElement).checked)).toBe(false);
    expect(screen.getByText(/padrão.*Verde/i)).toBeInTheDocument();
  });
});
