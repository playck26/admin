import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AdicionalDisponivel } from "@/lib/api-client";
import { SeletorDeAdicionais } from "./seletor-de-adicionais";

/**
 * **DEF-037 — a aula era marcada antes de a lista de adicionais aparecer.**
 *
 * Relatado pelo Israel: *"quando eu tento agendar uma aula avulsa, a aula é
 * marcada antes mesmo de eu poder escolher os itens adicionais, parece que vai
 * direto."*
 *
 * ## A causa
 *
 * O seletor tinha `disponiveis = []` antes da resposta da rede, e
 * `if (disponiveis.length === 0) return null`. Ou seja: **um mesmo nada** para
 * duas perguntas diferentes —
 *
 * | estado | o que a tela mostrava |
 * |---|---|
 * | ainda buscando | nada |
 * | o clube não tem adicional | nada |
 *
 * — e o botão de confirmar habilitado nos dois.
 *
 * **E a janela não era canto raro: era o caminho normal.** O componente só
 * MONTA depois do horário escolhido, então a busca começa exatamente no
 * instante em que a pessoa vai clicar em "Marcar aula".
 *
 * É a mesma família do DEF-035, que este projeto já registrou: *"um booleano
 * que responde a duas perguntas diferentes"*. Aqui é um **vazio** que responde
 * a duas.
 *
 * ## O que este arquivo julga
 *
 * Que os dois estados passaram a ter caras diferentes, e que quem usa o seletor
 * é **avisado** enquanto ele busca — que é o que permite ao botão esperar.
 */

const adicionaisDisponiveis = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api-client", async () => {
  const real =
    await vi.importActual<typeof import("@/lib/api-client")>("@/lib/api-client");
  return { ...real, adicionaisDisponiveis };
});

const RAQUETE: AdicionalDisponivel = {
  id: "a1",
  tipoId: "t1",
  tipoNome: "Raquetes",
  nome: "Raquete",
  preco: 15,
  disponivel: 2,
};

beforeEach(() => {
  adicionaisDisponiveis.mockReset();
});

describe("DEF-037 — buscando e vazio deixaram de ser a mesma tela", () => {
  it("enquanto busca, DIZ que está buscando", async () => {
    // Uma promessa que não resolve: é o estado que a pessoa vê enquanto a rede
    // responde, e era exatamente o que a tela não sabia desenhar.
    adicionaisDisponiveis.mockReturnValue(new Promise(() => {}));

    render(
      <SeletorDeAdicionais
        data="2026-09-21"
        slots={["09:00-10:00"]}
        onChange={() => {}}
      />,
    );

    expect(await screen.findByRole("status")).toHaveTextContent(
      /carregando adicionais/i,
    );
  });

  it("avisa quem usa: `true` ao começar, `false` ao terminar", async () => {
    let resolver: (v: AdicionalDisponivel[]) => void = () => {};
    adicionaisDisponiveis.mockReturnValue(
      new Promise<AdicionalDisponivel[]>((r) => {
        resolver = r;
      }),
    );
    const avisos: boolean[] = [];

    render(
      <SeletorDeAdicionais
        data="2026-09-21"
        slots={["09:00-10:00"]}
        onChange={() => {}}
        onCarregando={(c) => avisos.push(c)}
      />,
    );

    // **Este é o aviso que faltava.** Sem ele, o botão de confirmar não tem
    // como saber que deve esperar.
    await waitFor(() => expect(avisos).toContain(true));

    resolver([RAQUETE]);
    await waitFor(() => expect(avisos).toContain(false));

    // E a ordem importa: primeiro `true`, depois `false`.
    expect(avisos.indexOf(true)).toBeLessThan(avisos.lastIndexOf(false));
  });

  it("clube SEM adicional continua sumindo — e só depois de responder", async () => {
    adicionaisDisponiveis.mockResolvedValue([]);
    const avisos: boolean[] = [];

    const { container } = render(
      <SeletorDeAdicionais
        data="2026-09-21"
        slots={["09:00-10:00"]}
        onChange={() => {}}
        onCarregando={(c) => avisos.push(c)}
      />,
    );

    await waitFor(() => expect(avisos).toContain(false));
    // O comportamento antigo, preservado: sem adicional ativo, o seletor some.
    // A diferença é que agora ele some **depois** de saber, não antes.
    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });

  it("o erro da rede também encerra o carregando — o botão não trava", async () => {
    adicionaisDisponiveis.mockRejectedValue(new Error("rede"));
    const avisos: boolean[] = [];

    render(
      <SeletorDeAdicionais
        data="2026-09-21"
        slots={["09:00-10:00"]}
        onChange={() => {}}
        onCarregando={(c) => avisos.push(c)}
      />,
    );

    // Sem o `finally`, um erro deixaria `carregando` para sempre e a pessoa
    // nunca conseguiria confirmar — o defeito trocado por outro pior.
    await waitFor(() => expect(avisos).toContain(false));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      /não foi possível carregar/i,
    );
  });
});
