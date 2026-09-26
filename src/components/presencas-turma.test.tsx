import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EvasaoCard } from "./evasao-card";
import { FrequenciaAluno } from "./frequencia-aluno";
import { FrequenciaTurma } from "./frequencia-turma";
import { FALTA_E_AVISO, OrigensDaCobertura } from "./origens-da-cobertura";
import { PresencasTurma } from "./presencas-turma";

/**
 * TEST (SPEC-030:TASK-007) — o histórico de presença, do lado do gestor.
 *
 * **Esta tela não tinha teste nenhum até aqui**, e a SPEC-030 lhe deu a
 * primeira ação de escrita — até então era só leitura (LIM-002).
 *
 * O que estas provas guardam é o motivo de a spec existir: a aula que
 * ninguém respondeu **não aparecia nesta tela**, porque ela sempre filtrou
 * por `chamadaFeita`. Enquanto o professor está no clube isso é coerente
 * (quem lança é ele); quando ele sai, ninguém mais tem caminho, e o dia fica
 * vermelho para sempre no calendário.
 */

const listPresencasDaTurma = vi.hoisted(() => vi.fn());
const registrarNaoHouveAula = vi.hoisted(() => vi.fn());
const desfazerNaoHouveAula = vi.hoisted(() => vi.fn());
const getFrequenciaDaTurma = vi.hoisted(() => vi.fn());
const getFrequenciaDoAluno = vi.hoisted(() => vi.fn());
const getEvasao = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api-client", async () => {
  const real =
    await vi.importActual<typeof import("@/lib/api-client")>(
      "@/lib/api-client",
    );
  return {
    ...real,
    listPresencasDaTurma,
    registrarNaoHouveAula,
    desfazerNaoHouveAula,
    getFrequenciaDaTurma,
    getFrequenciaDoAluno,
    getEvasao,
  };
});

function ocorrencia(patch: Record<string, unknown> = {}) {
  return {
    ocupacaoId: "oc1",
    data: "2026-08-25",
    horaInicio: "18:00",
    horaFim: "19:00",
    cancelada: false,
    chamadaFeita: false,
    estado: "pendente",
    registradoPor: null,
    origem: null,
    origemInicial: null,
    alunos: [],
    ...patch,
  };
}

const COM_CHAMADA = ocorrencia({
  ocupacaoId: "oc-feita",
  data: "2026-08-24",
  chamadaFeita: true,
  estado: "feita",
  registradoPor: "Carlos Lima",
  origem: "professor",
  origemInicial: "professor",
  alunos: [
    { alunoId: "a1", nome: "Ana", status: "presente", naTurmaHoje: true, reposicao: false, alunoAtivo: true },
    { alunoId: "a2", nome: "Bruno", status: "ausente", naTurmaHoje: true, reposicao: false, alunoAtivo: true },
  ],
});

beforeEach(() => {
  listPresencasDaTurma.mockReset();
  registrarNaoHouveAula.mockReset();
  desfazerNaoHouveAula.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("PresencasTurma — aguardando fechamento (SPEC-030 → SPEC-076/D5)", () => {
  it("mostra a aula pendente, que antes era invisível para o gestor", async () => {
    listPresencasDaTurma.mockResolvedValue([ocorrencia()]);

    render(<PresencasTurma turmaId="t1" />);

    expect(await screen.findByText("Aguardando fechamento (1)")).toBeInTheDocument();
    expect(screen.getByText("25/08/2026")).toBeInTheDocument();
  });

  // SPEC-076 — o caminho normal é o fechamento automático, não o professor
  // lançar. A tela diz isso ANTES de oferecer a saída.
  it("diz que o fechamento é automático antes de oferecer o botão", async () => {
    listPresencasDaTurma.mockResolvedValue([ocorrencia()]);

    render(<PresencasTurma turmaId="t1" />);

    expect(
      await screen.findByText(/o fechamento automático ainda não passou/),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Quem lança a chamada é o professor/)).toBeNull();
  });

  it("não oferece a ação em aula futura, em andamento ou cancelada", async () => {
    listPresencasDaTurma.mockResolvedValue([
      ocorrencia({ ocupacaoId: "f", estado: "futura" }),
      ocorrencia({ ocupacaoId: "a", estado: "em_andamento" }),
      ocorrencia({ ocupacaoId: "c", estado: "cancelada", cancelada: true }),
    ]);

    render(<PresencasTurma turmaId="t1" />);

    await waitFor(() => expect(listPresencasDaTurma).toHaveBeenCalled());
    expect(screen.queryByText(/Aguardando fechamento/)).not.toBeInTheDocument();
  });

  it("pede confirmação, e desistir não chama a API", async () => {
    listPresencasDaTurma.mockResolvedValue([ocorrencia()]);
    vi.stubGlobal(
      "confirm",
      vi.fn(() => false),
    );

    render(<PresencasTurma turmaId="t1" />);
    fireEvent.click(
      await screen.findByRole("button", { name: "A aula não aconteceu" }),
    );

    expect(registrarNaoHouveAula).not.toHaveBeenCalled();
  });

  it("registra com turmaId e ocupacaoId, e relê a lista depois", async () => {
    listPresencasDaTurma
      .mockResolvedValueOnce([ocorrencia()])
      .mockResolvedValueOnce([
        ocorrencia({ chamadaFeita: true, estado: "nao_houve" }),
      ]);
    registrarNaoHouveAula.mockResolvedValue({
      ocupacaoId: "oc1",
      completude: "nao_houve",
    });
    vi.stubGlobal(
      "confirm",
      vi.fn(() => true),
    );

    render(<PresencasTurma turmaId="t1" />);
    fireEvent.click(
      await screen.findByRole("button", { name: "A aula não aconteceu" }),
    );

    await waitFor(() =>
      expect(registrarNaoHouveAula).toHaveBeenCalledWith("t1", "oc1"),
    );
    // Relê a lista inteira: a ocorrência MUDA DE GRUPO — sai de "sem
    // chamada" e entra em "Presenças". Remendar a linha localmente exigiria
    // reproduzir a regra de agrupamento que o servidor já resolveu.
    await waitFor(() =>
      expect(listPresencasDaTurma).toHaveBeenCalledTimes(2),
    );
    await waitFor(() =>
      expect(screen.queryByText(/Aguardando fechamento/)).not.toBeInTheDocument(),
    );
  });

  it("erro da API vira aviso, e a aula continua na lista", async () => {
    listPresencasDaTurma.mockResolvedValue([ocorrencia()]);
    registrarNaoHouveAula.mockRejectedValue(new Error("rede"));
    vi.stubGlobal(
      "confirm",
      vi.fn(() => true),
    );

    render(<PresencasTurma turmaId="t1" />);
    fireEvent.click(
      await screen.findByRole("button", { name: "A aula não aconteceu" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /não foi possível registrar/i,
    );
    expect(screen.getByText("Aguardando fechamento (1)")).toBeInTheDocument();
  });
});

describe("PresencasTurma — a aula não realizada na lista de baixo", () => {
  // `chamadaFeita` passou a incluir `nao_houve`, e ela tem ZERO presenças.
  // Sem tratar o estado, a linha diria "0/0 presentes" — que sugere uma
  // chamada lançada vazia pelo professor, o oposto do que aconteceu.
  it("diz 'aula não realizada' e 'sem chamada', nunca '0/0 presentes'", async () => {
    listPresencasDaTurma.mockResolvedValue([
      ocorrencia({ chamadaFeita: true, estado: "nao_houve", alunos: [] }),
    ]);

    render(<PresencasTurma turmaId="t1" />);

    expect(await screen.findByText("aula não realizada")).toBeInTheDocument();
    expect(screen.getByText("sem chamada")).toBeInTheDocument();
    expect(screen.queryByText("0/0 presentes")).not.toBeInTheDocument();
  });

  it("a chamada de verdade continua mostrando a contagem", async () => {
    listPresencasDaTurma.mockResolvedValue([COM_CHAMADA]);

    render(<PresencasTurma turmaId="t1" />);

    expect(await screen.findByText("1/2 presentes")).toBeInTheDocument();
  });
});

/**
 * TEST (SPEC-057/TASK-001/D1/D4/D5/D6) — a proveniência no histórico do gestor.
 *
 * Com o fechamento automático, "Lançada por" sem nome passou a ser o caso
 * normal. Estas provas guardam que a tela diz QUEM respondeu — inclusive
 * "ninguém ainda" — em vez de apagar a linha.
 */
describe("PresencasTurma — origem da chamada (SPEC-057)", () => {
  const AUTOMATICA = ocorrencia({
    ocupacaoId: "oc-auto",
    chamadaFeita: true,
    estado: "feita",
    origem: "automatica",
    origemInicial: "automatica",
    registradoPor: null,
    alunos: [
      { alunoId: "a1", nome: "Ana", status: "presente", naTurmaHoje: true, reposicao: false, alunoAtivo: true },
    ],
  });

  it("automática sem revisão: selo, de onde vem a falta e a exceção de 'não aconteceu'", async () => {
    listPresencasDaTurma.mockResolvedValue([AUTOMATICA]);
    render(<PresencasTurma turmaId="t1" />);

    expect(await screen.findByText("fechada automaticamente")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /25\/08\/2026/ }));
    expect(
      screen.getByText(/quem avisou falta pelo app aparece como Faltou/),
    ).toBeInTheDocument();

    const confirm = vi.fn(() => true);
    vi.stubGlobal("confirm", confirm);
    registrarNaoHouveAula.mockResolvedValue({ ocupacaoId: "oc-auto", completude: "nao_houve" });
    fireEvent.click(screen.getByRole("button", { name: "A aula não aconteceu" }));

    expect(confirm).toHaveBeenCalledWith(
      expect.stringContaining("presenças do fechamento automático serão apagadas"),
    );
    await waitFor(() =>
      expect(registrarNaoHouveAula).toHaveBeenCalledWith("t1", "oc-auto"),
    );
  });

  it("automática revisada: diz quem revisou e não oferece a exceção", async () => {
    listPresencasDaTurma.mockResolvedValue([
      { ...AUTOMATICA, origem: "professor", registradoPor: "Carlos Lima" },
    ]);
    render(<PresencasTurma turmaId="t1" />);

    fireEvent.click(await screen.findByRole("button", { name: /25\/08\/2026/ }));
    expect(
      screen.getByText("Fechada automaticamente e revisada por Carlos Lima."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "A aula não aconteceu" })).toBeNull();
  });

  it("legado: 'Registro humano anterior à automação', com o autor", async () => {
    listPresencasDaTurma.mockResolvedValue([
      { ...COM_CHAMADA, origem: "legada_humana", origemInicial: "legada_humana" },
    ]);
    render(<PresencasTurma turmaId="t1" />);

    fireEvent.click(await screen.findByRole("button", { name: /24\/08\/2026/ }));
    expect(
      screen.getByText("Registro humano anterior à automação — lançada por Carlos Lima."),
    ).toBeInTheDocument();
  });

  it("sem participantes: nem pendente, nem chamada — só a contagem", async () => {
    listPresencasDaTurma.mockResolvedValue([
      ocorrencia({ ocupacaoId: "oc-vazia", estado: "sem_participantes" }),
    ]);
    render(<PresencasTurma turmaId="t1" />);

    expect(await screen.findByText(/1 aula sem participantes/)).toBeInTheDocument();
    expect(screen.queryByText(/Aguardando fechamento/)).toBeNull();
  });
});

/**
 * TEST (DEF-035) — **o rótulo acusava de evasão quem veio repor.**
 *
 * `naTurmaHoje: false` vale para dois casos diferentes: quem saiu da turma e
 * quem nunca esteve nela. A tela só tinha esse campo e escolhia o primeiro.
 * Achado pela validação independente da TASK-001, na conferência visual.
 */
describe("PresencasTurma — visitante x ex-aluno (DEF-035)", () => {
  const COM_VISITANTE = ocorrencia({
    ocupacaoId: "oc-visita",
    chamadaFeita: true,
    estado: "feita",
    origem: "professor",
    origemInicial: "professor",
    registradoPor: "Carlos Lima",
    alunos: [
      { alunoId: "a1", nome: "Ana", status: "presente", naTurmaHoje: true, reposicao: false, alunoAtivo: true },
      { alunoId: "a7", nome: "Carla Visitante", status: "presente", naTurmaHoje: false, reposicao: true, alunoAtivo: true },
      { alunoId: "a9", nome: "Bruno Saiu", status: "ausente", naTurmaHoje: false, reposicao: false, alunoAtivo: true },
    ],
  });

  it("diz 'repondo aula' para quem repôs e 'saiu da turma' só para quem saiu", async () => {
    listPresencasDaTurma.mockResolvedValue([COM_VISITANTE]);
    render(<PresencasTurma turmaId="t1" />);

    fireEvent.click(await screen.findByRole("button", { name: /25\/08\/2026/ }));

    const visitante = screen.getByText("Carla Visitante").closest("li");
    const exAluno = screen.getByText("Bruno Saiu").closest("li");
    expect(visitante).toHaveTextContent("(repondo aula)");
    expect(visitante).not.toHaveTextContent("(saiu da turma)");
    expect(exAluno).toHaveTextContent("(saiu da turma)");
    expect(screen.getByText("Ana").closest("li")).not.toHaveTextContent("(");
  });
});

const ORIGENS = {
  automaticas: 1,
  ratificadas: 0,
  humanas: 1,
  pendentesLegadas: 1,
  pendentesAtuais: 1,
};
const COBERTURA = {
  aconteceram: 4,
  lancadas: 2,
  completas: 2,
  pctCompletas: 50,
  confianca: "alta",
  aviso: null,
  origens: ORIGENS,
};

/** Os arquivos de `src/`, para a frase que não pode mais existir. */
function arquivosDe(dir: string): string[] {
  return readdirSync(dir).flatMap((nome) => {
    const caminho = join(dir, nome);
    return statSync(caminho).isDirectory() ? arquivosDe(caminho) : [caminho];
  });
}

/**
 * SPEC-076/AC-021 — **o Admin diz de onde vem a falta.** As quatro telas da
 * D6 dizem que falta é aviso de falta pelo app; a frase que mandava esperar
 * correção do professor não existe mais em `src/`; e "Aguardando fechamento"
 * conta só `pendente`.
 */
describe("SPEC-076/AC-021 — falta é aviso de falta", () => {
  it("origens da cobertura: os rótulos novos e a frase", () => {
    render(<OrigensDaCobertura origens={ORIGENS} />);
    expect(
      screen.getByText(/1 sem registro, anteriores à automação/),
    ).toBeInTheDocument();
    expect(screen.getByText(/1 aguardando fechamento/)).toBeInTheDocument();
    expect(screen.getByText(FALTA_E_AVISO)).toBeInTheDocument();
    // O que a frase DIZ, e não só que ela aparece: as quatro telas mostram
    // a mesma constante, e é o conteúdo dela que a D6 decide.
    expect(FALTA_E_AVISO).toMatch(/aviso de falta pelo app/);
    expect(FALTA_E_AVISO).toMatch(/Ninguém corrige presença à mão/);
  });

  it("frequência da turma diz a frase", async () => {
    getFrequenciaDaTurma.mockResolvedValue({
      turmaId: "t1",
      turmaNome: "T",
      janelaDias: 30,
      cobertura: COBERTURA,
      alunos: [],
    });
    render(<FrequenciaTurma turmaId="t1" />);
    expect(await screen.findByText(FALTA_E_AVISO)).toBeInTheDocument();
  });

  it("frequência do aluno diz a frase", async () => {
    getFrequenciaDoAluno.mockResolvedValue({
      alunoId: "a1",
      nome: "Ana",
      alunoAtivo: true,
      vinculo: "aprovado",
      janelaDias: 30,
      agregado: { base: 3, frequenciaPct: 66, faltasSeguidas: 0, confianca: "alta" },
      porTurma: [
        {
          turmaId: "t1",
          turmaNome: "T",
          naTurmaHoje: true,
          visitante: false,
          presente: 2,
          ausente: 1,
          justificado: 0,
          frequenciaPct: 66,
          faltasSeguidas: 0,
          cobertura: COBERTURA,
        },
      ],
      ocorrencias: [],
    });
    render(<FrequenciaAluno alunoId="a1" />);
    expect(await screen.findByText(FALTA_E_AVISO)).toBeInTheDocument();
  });

  it("o cartão de evasão diz a frase", async () => {
    getEvasao.mockResolvedValue({
      total: 1,
      janelaDias: 30,
      alunos: [
        {
          alunoId: "a1",
          nome: "Ana",
          turmaId: "t1",
          turmaNome: "T",
          motivo: "faltas_seguidas",
          frequenciaPct: 40,
          base: 5,
          faltasSeguidas: 3,
          faltasSeguidasComposicao: { ausente: 3, justificado: 0 },
          confianca: "alta",
          cobertura: COBERTURA,
        },
      ],
    });
    render(<EvasaoCard />);
    expect(await screen.findByText(FALTA_E_AVISO)).toBeInTheDocument();
  });

  it("a frase antiga não existe mais em src/", () => {
    const comAFrase = arquivosDe(join(__dirname, ".."))
      .filter((f) => /\.(ts|tsx)$/.test(f))
      .filter((f) =>
        readFileSync(f, "utf8").includes(
          ["faltas devem ser corrigidas", "pelo professor"].join(" "),
        ),
      );
    expect(comAFrase).toEqual([]);
  });

  it("'Aguardando fechamento' conta só pendente — a sem_registro fica de fora, só contada", async () => {
    listPresencasDaTurma.mockResolvedValue([
      ocorrencia({ ocupacaoId: "oc-p", estado: "pendente" }),
      ocorrencia({ ocupacaoId: "oc-s", data: "2026-08-01", estado: "sem_registro" }),
    ]);
    render(<PresencasTurma turmaId="t1" />);

    expect(await screen.findByText("Aguardando fechamento (1)")).toBeInTheDocument();
    expect(screen.getByText(/1 aula sem registro/)).toBeInTheDocument();
    expect(screen.queryByText("01/08/2026")).toBeNull();
    expect(screen.getAllByRole("button", { name: "A aula não aconteceu" })).toHaveLength(1);
  });
});

/**
 * SPEC-076/AC-022 — **o "Desfazer (até …)" do gestor**: só com
 * `desfazerNaoHouveAte`, com confirmação, chama a rota do gestor e relê.
 */
describe("SPEC-076/AC-022 — desfazer o 'não aconteceu'", () => {
  const NAO_HOUVE = (extra: Record<string, unknown> = {}) =>
    ocorrencia({ chamadaFeita: true, estado: "nao_houve", ...extra });

  it("com o campo: mostra a data, confirma, chama o DELETE do gestor e relê", async () => {
    const ate = new Date(2026, 9, 3, 14, 30).toISOString();
    listPresencasDaTurma
      .mockResolvedValueOnce([NAO_HOUVE({ desfazerNaoHouveAte: ate })])
      .mockResolvedValueOnce([COM_CHAMADA]);
    desfazerNaoHouveAula.mockResolvedValue({ ocupacaoId: "oc1", estado: "feita" });
    const confirm = vi.fn(() => true);
    vi.stubGlobal("confirm", confirm);

    render(<PresencasTurma turmaId="t1" />);
    fireEvent.click(
      await screen.findByRole("button", { name: "Desfazer (até 03/10 às 14:30)" }),
    );

    expect(confirm).toHaveBeenCalled();
    await waitFor(() =>
      expect(desfazerNaoHouveAula).toHaveBeenCalledWith("t1", "oc1"),
    );
    await waitFor(() => expect(listPresencasDaTurma).toHaveBeenCalledTimes(2));
    expect(await screen.findByText("1/2 presentes")).toBeInTheDocument();
  });

  it("desistir da confirmação não chama a API", async () => {
    listPresencasDaTurma.mockResolvedValue([
      NAO_HOUVE({ desfazerNaoHouveAte: new Date(Date.now() + 86_400_000).toISOString() }),
    ]);
    vi.stubGlobal("confirm", vi.fn(() => false));

    render(<PresencasTurma turmaId="t1" />);
    fireEvent.click(await screen.findByRole("button", { name: /^Desfazer/ }));

    expect(desfazerNaoHouveAula).not.toHaveBeenCalled();
  });

  it("campo nulo: não aparece", async () => {
    listPresencasDaTurma.mockResolvedValue([NAO_HOUVE({ desfazerNaoHouveAte: null })]);
    render(<PresencasTurma turmaId="t1" />);
    await screen.findByText("aula não realizada");
    expect(screen.queryByRole("button", { name: /^Desfazer/ })).toBeNull();
  });

  it("Back anterior à SPEC-076 (sem o campo): não aparece", async () => {
    listPresencasDaTurma.mockResolvedValue([NAO_HOUVE()]);
    render(<PresencasTurma turmaId="t1" />);
    await screen.findByText("aula não realizada");
    expect(screen.queryByRole("button", { name: /^Desfazer/ })).toBeNull();
  });
});
