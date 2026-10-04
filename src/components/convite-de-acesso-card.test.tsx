import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, type SituacaoDoConvite } from "@/lib/api-client";
import type { paths } from "@/lib/api-types";
import { ConviteDeAcessoCard } from "./convite-de-acesso-card";
import { EditStudentForm } from "./edit-student-form";
import { EditTeacherForm } from "./edit-teacher-form";

/**
 * SPEC-083/AC-038 — **o cartão do convite nas fichas do aluno e do professor.**
 *
 * A situação vem pronta do Back (D9); o que a tela decide é o BOTÃO de cada
 * uma, e é onde ela pode errar de dois jeitos que custam caro:
 *
 * 1. **botão em `ativado`** — mandaria um link que define a senha de quem já
 *    tem senha, que é recuperação de senha (fora, I1);
 * 2. **botão vivo durante o envio** — o segundo clique revoga o convite que o
 *    primeiro acabou de mandar, e o e-mail que a pessoa abrir primeiro é o do
 *    link morto.
 */
const situacaoDoConvite = vi.hoisted(() => vi.fn());
const enviarConviteDeAcesso = vi.hoisted(() => vi.fn());
const getStudent = vi.hoisted(() => vi.fn());
const getTeacher = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api-client", async () => {
  const real =
    await vi.importActual<typeof import("@/lib/api-client")>(
      "@/lib/api-client",
    );
  return {
    ...real,
    situacaoDoConvite,
    enviarConviteDeAcesso,
    getStudent,
    getTeacher,
    listLevels: vi.fn().mockResolvedValue([]),
    regenerarSenhaTemporaria: vi.fn(),
    gerarAcessoProfessor: vi.fn(),
    updateStudent: vi.fn(),
    updateTeacher: vi.fn(),
  };
});

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

const EM = "2026-10-01T15:00:00.000Z";
const EXPIRA = "2026-10-08T15:00:00.000Z";

function situacao(s: Partial<SituacaoDoConvite>): SituacaoDoConvite {
  return { situacao: "nao_enviado", em: null, expiraEm: null, motivo: null, ...s };
}

beforeEach(() => {
  vi.clearAllMocks();
});

/**
 * As seis situações da D9, uma por caso, com o botão que a tabela manda e a
 * frase que distingue cada uma. `null` é "nenhum botão".
 */
const SEIS: readonly {
  s: SituacaoDoConvite;
  frase: RegExp;
  botao: string | null;
}[] = [
  { s: situacao({ situacao: "ativado", em: EM }), frase: /Conta ativada em/, botao: null },
  { s: situacao({ situacao: "sem_conta" }), frase: /Sem conta/, botao: "Enviar convite" },
  { s: situacao({ situacao: "nao_enviado" }), frase: /Convite não enviado/, botao: "Enviar convite" },
  {
    s: situacao({ situacao: "enviado", em: EM, expiraEm: EXPIRA }),
    frase: /Convite enviado em/,
    botao: "Reenviar",
  },
  {
    s: situacao({ situacao: "falhou", em: EM, expiraEm: EXPIRA, motivo: "cota" }),
    frase: /O envio falhou: o limite diário de e-mails foi atingido/,
    botao: "Reenviar",
  },
  {
    s: situacao({ situacao: "expirado", expiraEm: EXPIRA }),
    frase: /Convite expirado em/,
    botao: "Reenviar",
  },
];

describe("ConviteDeAcessoCard — AC-038, as seis situações", () => {
  it.each(SEIS)("$s.situacao → botão $botao", async ({ s, frase, botao }) => {
    situacaoDoConvite.mockResolvedValue(s);
    render(<ConviteDeAcessoCard pessoa="aluno" id="a-1" />);

    expect(await screen.findByText(frase)).toBeInTheDocument();
    expect(screen.getByTestId("convite-de-acesso")).toHaveAttribute(
      "data-situacao",
      s.situacao,
    );
    const botoes = screen.queryAllByRole("button");
    if (botao === null) {
      // `ativado`: nenhum botão — nem "Enviar", nem "Reenviar".
      expect(botoes).toHaveLength(0);
    } else {
      expect(botoes).toHaveLength(1);
      expect(botoes[0]).toHaveTextContent(botao);
      expect(botoes[0]).not.toBeDisabled();
    }
  });

  it("a tabela cobre exatamente as seis situações do contrato", () => {
    // Uma sétima situação no contrato sem caso aqui deixaria o `it.each`
    // verde sobre um caso que ninguém olhou.
    expect(new Set(SEIS.map((c) => c.s.situacao)).size).toBe(6);
  });

  it("`falhou` sem confirmação mostra o motivo `sem_confirmacao`", async () => {
    situacaoDoConvite.mockResolvedValue(
      situacao({ situacao: "falhou", expiraEm: EXPIRA, motivo: "sem_confirmacao" }),
    );
    render(<ConviteDeAcessoCard pessoa="aluno" id="a-1" />);
    expect(
      await screen.findByText(/o envio não chegou a ser confirmado/),
    ).toBeInTheDocument();
  });

  it("`enviado` diz até quando o link vale, e que enviado não é entregue", async () => {
    situacaoDoConvite.mockResolvedValue(
      situacao({ situacao: "enviado", em: EM, expiraEm: EXPIRA }),
    );
    render(<ConviteDeAcessoCard pessoa="aluno" id="a-1" />);
    // LIM-083a: a frase não pode prometer que chegou.
    expect(await screen.findByText(/O link vale até/)).toBeInTheDocument();
    expect(screen.getByText(/não que já chegou/)).toBeInTheDocument();
  });

  it("lê a situação pela rota da pessoa certa", async () => {
    situacaoDoConvite.mockResolvedValue(situacao({}));
    render(<ConviteDeAcessoCard pessoa="professor" id="p-1" />);
    await screen.findByText(/Convite não enviado/);
    expect(situacaoDoConvite).toHaveBeenCalledWith("professor", "p-1");
  });
});

describe("ConviteDeAcessoCard — o envio", () => {
  it("**o botão fica desabilitado durante o envio**, e volta com a situação nova", async () => {
    situacaoDoConvite.mockResolvedValue(situacao({ situacao: "nao_enviado" }));
    let responder: (s: SituacaoDoConvite) => void = () => undefined;
    enviarConviteDeAcesso.mockReturnValue(
      new Promise<SituacaoDoConvite>((r) => {
        responder = r;
      }),
    );
    render(<ConviteDeAcessoCard pessoa="aluno" id="a-1" />);

    fireEvent.click(await screen.findByRole("button", { name: /Enviar convite/ }));

    const durante = await screen.findByRole("button", { name: /Enviando/ });
    expect(durante).toBeDisabled();
    // O segundo clique, com o botão desabilitado, não emite outro convite.
    fireEvent.click(durante);
    expect(enviarConviteDeAcesso).toHaveBeenCalledTimes(1);
    expect(enviarConviteDeAcesso).toHaveBeenCalledWith("aluno", "a-1");

    await act(async () => {
      responder(situacao({ situacao: "enviado", em: EM, expiraEm: EXPIRA }));
    });

    expect(await screen.findByText(/Convite enviado em/)).toBeInTheDocument();
    const depois = screen.getByRole("button", { name: /Reenviar/ });
    expect(depois).not.toBeDisabled();
  });

  it("reenviar também fica desabilitado durante o envio", async () => {
    situacaoDoConvite.mockResolvedValue(
      situacao({ situacao: "expirado", expiraEm: EXPIRA }),
    );
    enviarConviteDeAcesso.mockReturnValue(new Promise(() => undefined));
    render(<ConviteDeAcessoCard pessoa="aluno" id="a-1" />);

    fireEvent.click(await screen.findByRole("button", { name: /Reenviar/ }));
    expect(await screen.findByRole("button", { name: /Enviando/ })).toBeDisabled();
  });

  it("a recusa do Back aparece inteira (`409 CONTA_JA_ATIVADA`)", async () => {
    situacaoDoConvite.mockResolvedValue(situacao({ situacao: "nao_enviado" }));
    enviarConviteDeAcesso.mockRejectedValue(
      new ApiError(
        409,
        "Esta pessoa já criou a própria senha, e o convite não se aplica. Se ela perdeu a senha, gere uma senha temporária.",
        undefined,
        "CONTA_JA_ATIVADA",
      ),
    );
    render(<ConviteDeAcessoCard pessoa="aluno" id="a-1" />);

    fireEvent.click(await screen.findByRole("button", { name: /Enviar convite/ }));
    const alerta = await screen.findByRole("alert");
    expect(alerta.textContent).toContain("gere uma senha temporária");
    // Depois da recusa o botão volta a valer: o gestor pode tentar de novo.
    expect(screen.getByRole("button", { name: /Enviar convite/ })).not.toBeDisabled();
  });
});

describe("ConviteDeAcessoCard — o professor sem conta", () => {
  it("sem e-mail na ficha, o botão fica barrado e a tela diz por quê", async () => {
    situacaoDoConvite.mockResolvedValue(situacao({ situacao: "sem_conta" }));
    render(<ConviteDeAcessoCard pessoa="professor" id="p-1" semEmail />);

    expect(
      await screen.findByRole("button", { name: /Enviar convite/ }),
    ).toBeDisabled();
    expect(screen.getByText(/Preencha o e-mail acima e salve/)).toBeInTheDocument();
  });

  it("com e-mail, enviar cria a conta e avisa a ficha", async () => {
    situacaoDoConvite.mockResolvedValue(situacao({ situacao: "sem_conta" }));
    const novo = situacao({ situacao: "enviado", em: EM, expiraEm: EXPIRA });
    enviarConviteDeAcesso.mockResolvedValue(novo);
    const onEnviado = vi.fn();
    render(
      <ConviteDeAcessoCard pessoa="professor" id="p-1" onEnviado={onEnviado} />,
    );

    fireEvent.click(await screen.findByRole("button", { name: /Enviar convite/ }));

    await waitFor(() => expect(onEnviado).toHaveBeenCalledWith(novo));
    expect(enviarConviteDeAcesso).toHaveBeenCalledWith("professor", "p-1");
    expect(await screen.findByText(/Convite enviado em/)).toBeInTheDocument();
  });

  it("`409 EMAIL_EM_USO` aparece com a mensagem do Back", async () => {
    situacaoDoConvite.mockResolvedValue(situacao({ situacao: "sem_conta" }));
    enviarConviteDeAcesso.mockRejectedValue(
      new ApiError(
        409,
        "Este e-mail já pertence a outra conta. Uma pessoa não pode ter duas contas na plataforma (LIM-001).",
        undefined,
        "EMAIL_EM_USO",
      ),
    );
    render(<ConviteDeAcessoCard pessoa="professor" id="p-1" />);

    fireEvent.click(await screen.findByRole("button", { name: /Enviar convite/ }));
    expect((await screen.findByRole("alert")).textContent).toContain(
      "já pertence a outra conta",
    );
  });
});

/**
 * A metade do AC-038 que o mock do componente não alcança: **para onde vai o
 * pedido, e com que método.** Os casos acima trocam `situacaoDoConvite` e
 * `enviarConviteDeAcesso` por `vi.fn()` e só conferem os argumentos
 * (`"professor", "p-1"`); por isso trocar o mapa aluno↔professor, errar o
 * segmento `convite-de-acesso` ou tirar o `POST` do envio deixava todos verdes
 * — e, sem o `POST`, o "Enviar convite" faria um GET, receberia a situação
 * antiga como se tivesse enviado, e nenhum e-mail sairia. Aqui as duas funções
 * são as REAIS, com o `fetch` simulado, como no multipart do AC-017.
 */
describe("SPEC-083/AC-038 — a rota e o método (D9)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // O caminho esperado é amarrado ao contrato gerado: se o Back renomear a
  // rota, o `tsc` reprova esta tabela antes de o teste rodar.
  type RotaDoContrato = keyof paths;
  const CASOS: readonly {
    pessoa: "aluno" | "professor";
    id: string;
    funcao: "situacaoDoConvite" | "enviarConviteDeAcesso";
    metodo: "GET" | "POST";
    contrato: RotaDoContrato;
    caminho: string;
  }[] = [
    {
      pessoa: "aluno",
      id: "a-1",
      funcao: "situacaoDoConvite",
      metodo: "GET",
      contrato: "/api/v1/students/{id}/convite-de-acesso",
      caminho: "/api/v1/students/a-1/convite-de-acesso",
    },
    {
      pessoa: "professor",
      id: "p-1",
      funcao: "situacaoDoConvite",
      metodo: "GET",
      contrato: "/api/v1/teachers/{id}/convite-de-acesso",
      caminho: "/api/v1/teachers/p-1/convite-de-acesso",
    },
    {
      pessoa: "aluno",
      id: "a-1",
      funcao: "enviarConviteDeAcesso",
      metodo: "POST",
      contrato: "/api/v1/students/{id}/convite-de-acesso",
      caminho: "/api/v1/students/a-1/convite-de-acesso",
    },
    {
      pessoa: "professor",
      id: "p-1",
      funcao: "enviarConviteDeAcesso",
      metodo: "POST",
      contrato: "/api/v1/teachers/{id}/convite-de-acesso",
      caminho: "/api/v1/teachers/p-1/convite-de-acesso",
    },
  ];

  it.each(CASOS)(
    "$funcao($pessoa) → $metodo $caminho",
    async ({ pessoa, id, funcao, metodo, contrato, caminho }) => {
      // A tabela não pode divergir de si mesma: o caminho concreto é o do
      // contrato com o `{id}` preenchido.
      expect(caminho).toBe(contrato.replace("{id}", id));

      const real =
        await vi.importActual<typeof import("@/lib/api-client")>(
          "@/lib/api-client",
        );
      const corpo = situacao({ situacao: "enviado", em: EM, expiraEm: EXPIRA });
      const resposta = {
        ok: true,
        status: 200,
        json: () => Promise.resolve(corpo),
        clone: () => resposta,
      };
      const fetchMock = vi.fn().mockResolvedValue(resposta);
      vi.stubGlobal("fetch", fetchMock);

      await expect(real[funcao](pessoa, id)).resolves.toEqual(corpo);

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(new URL(url).pathname).toBe(caminho);
      // Sem `method` o `fetch` faz GET; o envio TEM de dizer POST.
      expect((init.method ?? "GET").toUpperCase()).toBe(metodo);
    },
  );
});

describe("AC-038 — o cartão está nas duas fichas", () => {
  it("na ficha do aluno, ao lado do gerar senha temporária", async () => {
    getStudent.mockResolvedValue({
      id: "a-1",
      nome: "Fulano",
      email: "fulano@x.com",
      telefone: null,
      nivelId: null,
      status: "ativo",
      vinculo: "aprovado",
    });
    situacaoDoConvite.mockResolvedValue(
      situacao({ situacao: "enviado", em: EM, expiraEm: EXPIRA }),
    );
    render(<EditStudentForm id="a-1" />);

    expect(await screen.findByText(/Convite enviado em/)).toBeInTheDocument();
    expect(screen.getByText("Gerar nova senha temporária")).toBeInTheDocument();
    expect(situacaoDoConvite).toHaveBeenCalledWith("aluno", "a-1");
  });

  it("na ficha do professor sem conta: enviar relê a ficha, e o botão de senha muda", async () => {
    const semConta = {
      id: "p-1",
      nome: "Prof",
      email: "prof@x.com",
      telefone: null,
      status: "ativo",
      usuarioId: null,
      fotoUrl: null,
      precoAula: null,
    };
    getTeacher
      .mockResolvedValueOnce(semConta)
      .mockResolvedValueOnce({ ...semConta, usuarioId: "u-1" });
    situacaoDoConvite.mockResolvedValue(situacao({ situacao: "sem_conta" }));
    enviarConviteDeAcesso.mockResolvedValue(
      situacao({ situacao: "enviado", em: EM, expiraEm: EXPIRA }),
    );
    render(<EditTeacherForm id="p-1" />);

    expect(await screen.findByText("Gerar acesso do professor")).toBeInTheDocument();
    fireEvent.click(await screen.findByRole("button", { name: /Enviar convite/ }));

    expect(await screen.findByText(/Convite enviado em/)).toBeInTheDocument();
    // O envio criou a conta: a ficha relida já não oferece "gerar acesso".
    expect(
      await screen.findByText("Gerar nova senha temporária"),
    ).toBeInTheDocument();
    expect(getTeacher).toHaveBeenCalledTimes(2);
    expect(situacaoDoConvite).toHaveBeenCalledWith("professor", "p-1");
  });

  it("na ficha do professor sem e-mail, o envio fica barrado", async () => {
    getTeacher.mockResolvedValue({
      id: "p-1",
      nome: "Prof",
      email: null,
      telefone: null,
      status: "ativo",
      usuarioId: null,
      fotoUrl: null,
      precoAula: null,
    });
    situacaoDoConvite.mockResolvedValue(situacao({ situacao: "sem_conta" }));
    render(<EditTeacherForm id="p-1" />);

    expect(
      await screen.findByRole("button", { name: /Enviar convite/ }),
    ).toBeDisabled();
  });
});
