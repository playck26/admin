import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { StudentsList } from "./students-list";

const ALUNO = {
  id: "a1",
  nome: "Aluno Teste",
  email: "aluno@x.com",
  telefone: null,
  nivelId: null,
  status: "ativo",
};

function paginado(data: unknown[]) {
  return { ok: true, json: async () => ({ data, page: 1, pageSize: 20, total: data.length }) };
}

/**
 * O mock responde por rota, e não uma resposta única para tudo: a tela faz
 * duas chamadas diferentes (listagem e fila de pendentes, SPEC-009) e um
 * mock cego devolveria o mesmo aluno nas duas, escondendo justamente o que
 * o teste deveria distinguir.
 */
function mockRotas(
  pendentes: unknown[],
  alunos: unknown[] = [ALUNO],
  // SPEC-057/TASK-004 — a tela passou a pedir o catalogo de niveis para a
  // coluna e para o filtro. `/levels` responde ARRAY, nao envelope paginado:
  // devolver o envelope aqui fazia `niveis.find` explodir, e o erro falava de
  // `find`, nao da rota.
  niveis: unknown[] = [],
) {
  (fetch as unknown as ReturnType<typeof vi.fn>).mockImplementation(
    (url: string) => {
      const alvo = String(url);
      if (alvo.includes("/levels")) {
        return Promise.resolve({ ok: true, json: async () => niveis });
      }
      return Promise.resolve(
        alvo.includes("vinculo=pendente") ? paginado(pendentes) : paginado(alunos),
      );
    },
  );
}

describe("StudentsList", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  it("mostra os alunos retornados pela API", async () => {
    mockRotas([]);

    render(<StudentsList />);

    expect(await screen.findByText("Aluno Teste")).toBeInTheDocument();
    expect(screen.getByText("Ativo")).toBeInTheDocument();
  });

  it("mostra estado vazio quando não há alunos", async () => {
    mockRotas([], []);

    render(<StudentsList />);

    await waitFor(() =>
      expect(screen.getByText("Nenhum aluno cadastrado ainda.")).toBeInTheDocument(),
    );
  });

  // SPEC-009/REQ-008: quem se auto-cadastra fica numa fila até um admin
  // decidir. A fila só aparece quando há alguém nela.
  it("não mostra a fila de aprovação quando não há pendentes", async () => {
    mockRotas([]);

    render(<StudentsList />);

    await screen.findByText("Aluno Teste");
    expect(screen.queryByText(/aguardando aprovação/i)).not.toBeInTheDocument();
  });

  it("lista cadastros pendentes e aprova (AC-015)", async () => {
    mockRotas([{ ...ALUNO, id: "p1", nome: "Pessoa Pendente", email: "p@x.com" }]);

    render(<StudentsList />);

    expect(
      await screen.findByText(/Cadastros aguardando aprovação \(1\)/),
    ).toBeInTheDocument();
    expect(screen.getByText("Pessoa Pendente")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Aprovar" }));

    await waitFor(() => {
      const chamadas = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls;
      expect(
        chamadas.some(([url]) => String(url).includes("/students/p1/aprovar")),
      ).toBe(true);
    });
  });
});

/**
 * SPEC-057/TASK-004 (card 5350) — **o gestor precisa ver quem ficou sem
 * nível ANTES de o filtro do aluno entrar no ar.**
 *
 * `alunos.nivel_id` existe desde a primeira migration, mas é anulável e o
 * nulo é o estado normal. Ligar o recorte no app sem saber quantos estão sem
 * classificação seria ligar às cegas.
 */
describe("StudentsList — o filtro de nível", () => {
  const NIVEIS = [
    { id: "n1", nome: "Iniciante", ordem: 0 },
    { id: "n2", nome: "Avançado", ordem: 1 },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const urlsPedidas = () =>
    (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.map((c) =>
      String(c[0]),
    );

  it("sem níveis cadastrados, o filtro nem aparece", async () => {
    mockRotas([], [ALUNO], []);
    render(<StudentsList />);

    await screen.findByText("Aluno Teste");
    expect(screen.queryByLabelText("Nível")).toBeNull();
  });

  it("com níveis, oferece cada um mais `Sem nível`", async () => {
    mockRotas([], [ALUNO], NIVEIS);
    render(<StudentsList />);

    const seletor = await screen.findByLabelText("Nível");
    const opcoes = Array.from(
      seletor.querySelectorAll("option"),
    ).map((o) => o.textContent);
    expect(opcoes).toEqual([
      "Todos os níveis",
      "Iniciante",
      "Avançado",
      "Sem nível",
    ]);
  });

  it("escolher um nível manda `nivelId` ao servidor", async () => {
    mockRotas([], [ALUNO], NIVEIS);
    render(<StudentsList />);

    fireEvent.change(await screen.findByLabelText("Nível"), {
      target: { value: "n2" },
    });

    await waitFor(() => {
      expect(urlsPedidas().some((u) => u.includes("nivelId=n2"))).toBe(true);
    });
  });

  /** **A opção que justifica a tela.** */
  it("`Sem nível` manda `semNivel=true`, e NUNCA `nivelId`", async () => {
    mockRotas([], [ALUNO], NIVEIS);
    render(<StudentsList />);

    fireEvent.change(await screen.findByLabelText("Nível"), {
      target: { value: "SEM_NIVEL" },
    });

    await waitFor(() => {
      expect(urlsPedidas().some((u) => u.includes("semNivel=true"))).toBe(true);
    });
    // `SEM_NIVEL` no `nivelId` seria recusado com 400 pelo back — o gate de
    // UUID de lá não aceita literal nesse campo.
    expect(urlsPedidas().some((u) => u.includes("nivelId=SEM_NIVEL"))).toBe(
      false,
    );
  });

  it("a coluna mostra o nome do nível, e `—` para quem não tem", async () => {
    mockRotas(
      [],
      [
        { ...ALUNO, id: "a1", nome: "Com nível", nivelId: "n1" },
        { ...ALUNO, id: "a2", nome: "Sem nível nenhum", nivelId: null },
      ],
      NIVEIS,
    );
    render(<StudentsList />);

    // **Dentro da LINHA, e não na tela inteira:** "Iniciante" também é uma
    // opção do seletor, e `getByText` acharia as duas — a prova passaria
    // sem a coluna existir.
    const linhaComNivel = (await screen.findByText("Com nível")).closest("tr");
    expect(linhaComNivel).toHaveTextContent("Iniciante");

    const linhaSemNivel = screen.getByText("Sem nível nenhum").closest("tr");
    // Célula em branco pareceria dado que não carregou.
    expect(linhaSemNivel).toHaveTextContent("—");
  });

  it("vazio do filtro diz qual vazio é", async () => {
    mockRotas([], [], NIVEIS);
    render(<StudentsList />);

    fireEvent.change(await screen.findByLabelText("Nível"), {
      target: { value: "SEM_NIVEL" },
    });

    expect(
      await screen.findByText("Todo aluno deste clube já tem nível."),
    ).toBeInTheDocument();
  });
});
