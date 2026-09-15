import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ItensDaReserva } from "./itens-da-reserva";

/**
 * SPEC-054/D12 — os adicionais aparecem na reserva: o gestor que olha a grade ou
 * o dia precisa saber que vai entregar duas raquetes.
 */
describe("ItensDaReserva — SPEC-054/D12", () => {
  it("mostra quantidade e nome de cada item", () => {
    render(
      <ItensDaReserva
        adicionais={[
          { adicionalId: "a1", nome: "Raquete", quantidade: 2, valorUnitario: 15 },
          { adicionalId: "a2", nome: "Bola", quantidade: 1, valorUnitario: 5 },
        ]}
      />,
    );
    expect(screen.getByText("2× Raquete, 1× Bola")).toBeInTheDocument();
  });

  it("sem item — ou o back anterior, que não manda o campo — não mostra nada", () => {
    const { container: vazio } = render(<ItensDaReserva adicionais={[]} />);
    expect(vazio).toBeEmptyDOMElement();
    const { container: ausente } = render(<ItensDaReserva adicionais={undefined} />);
    expect(ausente).toBeEmptyDOMElement();
  });
});
