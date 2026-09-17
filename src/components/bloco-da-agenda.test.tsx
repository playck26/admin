import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ItemDoDia } from "@/lib/api-client";
import { BlocoDaAgenda } from "./bloco-da-agenda";

/**
 * SPEC-057/TASK-005/D19/AC-033 — **o bloco se lê sem cor.**
 *
 * jsdom não desenha, então "modo sem cor" aqui é o que dá para provar de
 * verdade: TUDO que identifica o item — quadra, código, tipo, estado,
 * lotação — está no TEXTO acessível, e a cor da quadra só aparece num
 * marcador `aria-hidden`. Se alguém voltar a pintar o fundo por tipo ou
 * esconder o estado numa cor, estes testes não percebem a cor, mas percebem
 * o texto que sumiu.
 *
 * A conferência visual (viewport 320 px, 12 quadras, teclado, foco) é de
 * navegador, e está declarada como não executada nesta task.
 */

afterEach(cleanup);

function item(over: Partial<ItemDoDia> = {}): ItemDoDia {
  return {
    id: "o1",
    quadraId: "11111111-1111-4111-8111-111111111111",
    quadraNome: "Quadra Central",
    quadraCor: "#31658C",
    quadraCodigoAgenda: "7",
    horaInicio: "09:00",
    horaFim: "10:00",
    origemTipo: "AVULSO",
    origemTurmaId: null,
    tipoVisual: "AVULSO",
    responsavel: "Ana",
    statusPagamento: "pendente_pagamento",
    valor: 100,
    criadaPor: null,
    canceladaPor: null,
    adicionais: [],
    capacidade: null,
    matriculados: null,
    faltasAvisadas: null,
    reposicoesMarcadas: null,
    reposicoesNaOcupacao: null,
    ocupados: null,
    vagasNaOcorrencia: null,
    ...over,
  };
}

describe("BlocoDaAgenda (D19)", () => {
  it("escreve quadra + código, tipo e estado — a cor não é necessária para ler", () => {
    render(<BlocoDaAgenda item={item()} onClick={() => {}} />);

    const bloco = screen.getByRole("button");
    expect(bloco).toHaveTextContent("09:00–10:00");
    expect(bloco).toHaveTextContent("Ana");
    expect(bloco).toHaveTextContent("Quadra Central · Q-7");
    expect(bloco).toHaveTextContent("Reserva");
    expect(bloco).toHaveTextContent("Pendente");
  });

  it("a cor da quadra está SÓ num marcador decorativo, e o fundo é branco opaco", () => {
    render(<BlocoDaAgenda item={item()} onClick={() => {}} />);

    const bloco = screen.getByRole("button");
    expect(bloco.style.backgroundColor).toBe("rgb(255, 255, 255)");
    const marcador = bloco.querySelector("[data-marcador-da-quadra]");
    expect(marcador).not.toBeNull();
    expect(marcador).toHaveAttribute("aria-hidden", "true");
    expect((marcador as HTMLElement).style.backgroundColor).toBe(
      "rgb(49, 101, 140)",
    );
  });

  it("sem opacidade, sem corte de texto, e alvo de pelo menos 44 px", () => {
    render(
      <BlocoDaAgenda
        item={item({ quadraNome: "Q".repeat(80) })}
        onClick={() => {}}
      />,
    );

    const bloco = screen.getByRole("button");
    const classes = [bloco, ...Array.from(bloco.querySelectorAll("*"))]
      .map((el) => el.getAttribute("class") ?? "")
      .join(" ");
    expect(classes).not.toMatch(/\bopacity-|\btruncate\b|line-clamp/);
    expect(bloco.className).toMatch(/\bmin-h-11\b/);
    // O nome de 80 caracteres chega INTEIRO, com o código ao lado.
    expect(bloco).toHaveTextContent(`${"Q".repeat(80)} · Q-7`);
  });

  it("duas quadras homônimas e da mesma cor viram dois textos diferentes", () => {
    render(
      <>
        <BlocoDaAgenda
          item={item({ id: "a", quadraNome: "Quadra 1", quadraCor: "#00763A", quadraCodigoAgenda: "3" })}
          onClick={() => {}}
        />
        <BlocoDaAgenda
          item={item({ id: "b", quadraNome: "Quadra 1", quadraCor: "#00763A", quadraCodigoAgenda: "4" })}
          onClick={() => {}}
        />
      </>,
    );

    expect(screen.getByText("Quadra 1 · Q-3")).toBeInTheDocument();
    expect(screen.getByText("Quadra 1 · Q-4")).toBeInTheDocument();
  });

  it.each([
    [{ tipoVisual: "TURMA", origemTipo: "TURMA", ocupados: 9, capacidade: 8, vagasNaOcorrencia: 0 }, ["Turma", "Programada", "Cheia · 9/8"]],
    [{ tipoVisual: "PARTICULAR", statusPagamento: "pago" }, ["Particular", "Pago"]],
    [{ tipoVisual: "AVULSO", statusPagamento: "cancelado" }, ["Reserva", "Cancelada"]],
  ] as const)("tipo e estado por texto: %o", (over, textos) => {
    render(<BlocoDaAgenda item={item(over as Partial<ItemDoDia>)} onClick={() => {}} />);

    for (const t of textos) {
      expect(screen.getByRole("button")).toHaveTextContent(t);
    }
  });

  it("pendente tem borda tracejada; pago, contínua — o estado também é forma", () => {
    const { rerender } = render(<BlocoDaAgenda item={item()} onClick={() => {}} />);
    expect(screen.getByRole("button").className).toMatch(/\bborder-dashed\b/);

    rerender(
      <BlocoDaAgenda item={item({ statusPagamento: "pago" })} onClick={() => {}} />,
    );
    expect(screen.getByRole("button").className).toMatch(/\bborder-solid\b/);
  });

  it("clique e teclado chamam a ação", () => {
    const onClick = vi.fn();
    render(<BlocoDaAgenda item={item()} onClick={onClick} />);

    const bloco = screen.getByRole("button");
    fireEvent.click(bloco);
    expect(onClick).toHaveBeenCalledTimes(1);
    // É um <button> de verdade: Enter e Espaço vêm do navegador, e o foco
    // alcança o bloco pela ordem natural.
    expect(bloco.tagName).toBe("BUTTON");
    expect(bloco).not.toHaveAttribute("tabindex", "-1");
  });
});
