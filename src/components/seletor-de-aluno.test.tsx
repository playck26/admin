import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SeletorDeAluno } from "./seletor-de-aluno";

/**
 * SPEC-049/REQ-002 — o seletor que alcança além do centésimo aluno.
 *
 * **O que este arquivo guarda** é o que não se vê olhando a tela: que o aluno
 * já escolhido **não some** quando a busca muda (AC-007), que o total dito é o
 * do servidor, e que duas buscas em voo não pintam a resposta errada.
 */
const listar = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api-client", async () => {
  const real =
    await vi.importActual<typeof import("@/lib/api-client")>(
      "@/lib/api-client",
    );
  return { ...real, listStudents: listar };
});

function pagina(nomes: string[], total = nomes.length) {
  return {
    data: nomes.map((nome, i) => ({ id: `a-${nome}-${i}`, nome })),
    total,
    page: 1,
    pageSize: 20,
    totalPages: 1,
  };
}

function montar(valor = "", onEscolher = vi.fn()) {
  render(
    <SeletorDeAluno id="aluno" valor={valor} onEscolher={onEscolher} />,
  );
  return onEscolher;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ shouldAdvanceTime: true });
  listar.mockResolvedValue(pagina(["Ana Beatriz", "João da Silva"]));
});

/** O campo espera 300 ms depois da última tecla. */
async function passarODebounce() {
  await vi.advanceTimersByTimeAsync(350);
}

describe("SeletorDeAluno", () => {
  it("AC-008: sem digitar nada, já mostra os primeiros alunos", async () => {
    montar();
    await passarODebounce();
    // O clube pequeno não pode piorar por causa do clube grande.
    expect(await screen.findByRole("option", { name: "Ana Beatriz" })).toBeInTheDocument();
    expect(listar).toHaveBeenCalledWith(1, 20, "");
  });

  it("AC-006: digitar busca NO SERVIDOR, não filtra no cliente", async () => {
    montar();
    await passarODebounce();
    fireEvent.change(screen.getByLabelText(/Buscar/i), {
      target: { value: "silva" },
    });
    await passarODebounce();

    // Filtrar no cliente só acharia entre os que já vieram — e o problema é
    // justamente o aluno que NÃO veio.
    expect(listar).toHaveBeenLastCalledWith(1, 20, "silva");
  });

  it("**espera a digitação parar: 'joao' não vira quatro requisições**", async () => {
    montar();
    await passarODebounce();
    listar.mockClear();

    const campo = screen.getByLabelText(/Buscar/i);
    // **Tecla a cada 100 ms**, que e digitacao de gente. Disparar as quatro no
    // mesmo tick provaria so que o efeito limpa o timer anterior -- e a
    // sabotagem de trocar 300 por 0 PASSAVA nessa versao.
    for (const v of ["j", "jo", "joa", "joao"]) {
      fireEvent.change(campo, { target: { value: v } });
      await vi.advanceTimersByTimeAsync(100);
    }
    // 300 ms depois da primeira tecla ja passaram, e **nada foi pedido ainda**:
    // e a espera, nao o cleanup, que segura.
    expect(listar).not.toHaveBeenCalled();

    await passarODebounce();
    expect(listar).toHaveBeenCalledTimes(1);
    expect(listar).toHaveBeenCalledWith(1, 20, "joao");
  });

  it("**AC-007: o aluno escolhido NÃO some quando a busca muda**", async () => {
    const onEscolher = vi.fn();
    const { rerender } = render(
      <SeletorDeAluno id="aluno" valor="" onEscolher={onEscolher} />,
    );
    await passarODebounce();

    const select = screen.getByLabelText("Aluno") as HTMLSelectElement;
    const ana = (await screen.findByRole("option", { name: "Ana Beatriz" })) as HTMLOptionElement;
    fireEvent.change(select, { target: { value: ana.value } });
    expect(onEscolher).toHaveBeenCalledWith(ana.value, "Ana Beatriz");

    // O pai agora controla o valor — como fazem as quatro telas de verdade.
    rerender(
      <SeletorDeAluno id="aluno" valor={ana.value} onEscolher={onEscolher} />,
    );

    // Busca seguinte não traz a Ana.
    listar.mockResolvedValue(pagina(["Carlos Pereira"]));
    fireEvent.change(screen.getByLabelText(/Buscar/i), {
      target: { value: "carlos" },
    });
    await passarODebounce();
    await screen.findByRole("option", { name: "Carlos Pereira" });

    // **A armadilha deste campo**: derivar o escolhido da lista faria o
    // `<select>` cair para "Selecione…" sozinho, e o gestor marcaria para
    // ninguém.
    expect(screen.getByRole("option", { name: "Ana Beatriz" })).toBeInTheDocument();
    expect(select.value).toBe(ana.value);
  });

  it("AC-009-ish: diz o TOTAL do servidor e que há mais", async () => {
    listar.mockResolvedValue(pagina(["Ana Beatriz", "João da Silva"], 340));
    montar();
    await passarODebounce();

    // Consertar o número que mente num lugar e recriá-lo no outro seria o
    // mesmo defeito com outro nome.
    expect(await screen.findByText(/Mostrando 2 de 340/)).toBeInTheDocument();
  });

  it("ensina o contorno do acento (LIM-049a) quando não há mais a mostrar", async () => {
    montar();
    await passarODebounce();
    expect(
      await screen.findByText(/Sem acento não encontra/),
    ).toBeInTheDocument();
  });

  it("**resposta atrasada não pinta a tela**", async () => {
    // Duas buscas em voo voltam fora de ordem. Sem o porteiro, a lista
    // mostraria o resultado do que o gestor já apagou.
    let resolverPrimeira!: (v: unknown) => void;
    listar
      .mockImplementationOnce(
        () => new Promise((r) => (resolverPrimeira = r)),
      )
      .mockResolvedValueOnce(pagina(["Carlos Pereira"]));

    montar();
    // **A primeira chamada e a da MONTAGEM** (busca vazia) -- e era isso que a
    // primeira versao deste caso errava: ela dava a promessa pendente para a
    // busca de "carlos", e entao "Carlos Pereira" nunca chegava.
    await passarODebounce();

    fireEvent.change(screen.getByLabelText(/Buscar/i), {
      target: { value: "carlos" },
    });
    await passarODebounce();
    await screen.findByRole("option", { name: "Carlos Pereira" });

    // A primeira resposta chega DEPOIS, com dados velhos.
    resolverPrimeira(pagina(["Ana Beatriz", "João da Silva"]));
    await waitFor(() =>
      expect(screen.getByRole("option", { name: "Carlos Pereira" })).toBeInTheDocument(),
    );
    expect(screen.queryByRole("option", { name: "Ana Beatriz" })).toBeNull();
  });
});
