"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { CampoSenha } from "@/components/campo-senha";
import { LOGIN_APOS_REDEFINICAO } from "@/components/login-form";
import { ehMuitasTentativas, TEXTO_DE_MUITAS_TENTATIVAS } from "@/components/esqueci-senha-form";
import { LogoDaEmpresa } from "@/components/logo-da-empresa";
import {
  ApiError,
  getRedefinicao,
  redefinirSenha,
  type ContaDaRedefinicao,
} from "@/lib/api-client";

/** D9 — o estado do `410` no `GET` ou no `POST`, e do número de contas ≠ 1. */
export const TEXTO_LINK_DE_REDEFINICAO_INVALIDO = "Este link não vale mais.";

/** O mínimo do `RedefinirSenhaDto` (`MinLength(8)`), o mesmo de todo campo de senha. */
const TAMANHO_MINIMO_DA_SENHA = 8;

type Tela =
  | { fase: "carregando" }
  | { fase: "formulario"; conta: ContaDaRedefinicao }
  | { fase: "link-invalido" }
  /** `muitasTentativas`: o `GET` voltou `429` (I9), e a tela diz isso, não "falhou". */
  | { fase: "falha-ao-abrir"; muitasTentativas: boolean };

/**
 * O papel como a tela diz. No Admin é sempre gestor (D6); os outros dois só
 * apareceriam com um link do Cliente colado aqui, e então a tela diz a
 * verdade em vez de chamar um aluno de gestor.
 */
const NOME_DO_PAPEL: Record<ContaDaRedefinicao["papel"], string> = {
  company_admin: "Gestor",
  aluno: "Aluno",
  professor: "Professor",
};

function ehLinkInvalido(erro: unknown): boolean {
  return erro instanceof ApiError && erro.status === 410;
}

/**
 * SPEC-090 (D4, D5, D9) — **a página do link que chega por e-mail, no Admin.**
 *
 * **Sem lista de contas.** O e-mail de gestor tem uma conta só na plataforma
 * (o `EXCLUDE` e o índice único da SPEC-086), e o Back só manda link do Admin
 * para pedido de gestor (D6). Por isso:
 *
 * - `GET` com **exatamente uma** conta → o formulário, com o clube em cima;
 * - `GET` com **zero ou duas ou mais** → o mesmo estado do `410`. Duas contas
 *   aqui só aconteceriam com um link do Cliente colado no endereço do Admin,
 *   e a escolha da conta mora lá;
 * - `410` → "Este link não vale mais." e "Pedir outro link".
 *
 * O `204` manda para `LOGIN_APOS_REDEFINICAO`, **importado** do login, que é
 * quem lê o parâmetro e mostra "Senha redefinida." na região de status dele.
 *
 * ## O que esta tela NÃO faz
 *
 * - **Não abre sessão** (D5): o gestor entra pelo login com a senha nova.
 * - **Não diz por que o link morreu:** usado, vencido, senha trocada por outro
 *   caminho — o servidor responde o mesmo `410` para todos, de propósito.
 * - **Não manda o `Referer`:** a página declara `no-referrer` e as duas
 *   chamadas repetem a regra (`api-client.ts`).
 *
 * `replace`, e não `push`, depois do `204`: o link já foi gasto, e o "voltar"
 * do navegador não deve devolver a pessoa a um formulário que só responde
 * `410`.
 */
export function RedefinirSenhaForm({ token }: { token: string }) {
  const router = useRouter();
  const [tela, setTela] = useState<Tela>({ fase: "carregando" });
  /** Muda a cada "Tentar de novo": é o que faz o efeito buscar outra vez. */
  const [tentativa, setTentativa] = useState(0);
  const [senha, setSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    // Resposta de uma tentativa antiga que chega depois da nova não pinta a
    // tela (DEF-021).
    let valendo = true;
    getRedefinicao(token)
      .then(({ contas }) => {
        if (!valendo) return;
        setTela(
          contas.length === 1
            ? { fase: "formulario", conta: contas[0] }
            : { fase: "link-invalido" },
        );
      })
      .catch((e: unknown) => {
        if (!valendo) return;
        // Só o `410` é link morto. Falha de rede ou `5xx` não diz nada sobre
        // o link, e mandar pedir outro por causa disso faria esperar outro
        // e-mail à toa.
        setTela(
          ehLinkInvalido(e)
            ? { fase: "link-invalido" }
            : { fase: "falha-ao-abrir", muitasTentativas: ehMuitasTentativas(e) },
        );
      });
    return () => {
      valendo = false;
    };
  }, [token, tentativa]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>, conta: ContaDaRedefinicao) {
    event.preventDefault();
    setErro(null);

    if (senha.length < TAMANHO_MINIMO_DA_SENHA) {
      setErro("A senha precisa ter pelo menos 8 caracteres.");
      return;
    }
    if (senha !== confirmacao) {
      setErro("As duas senhas não são iguais.");
      return;
    }

    setEnviando(true);
    try {
      await redefinirSenha({ token, usuarioId: conta.usuarioId, senha });
    } catch (e) {
      if (ehLinkInvalido(e)) {
        // O link morreu entre abrir a página e enviar (vencido, usado, senha
        // trocada). O formulário sai: ele só responderia `410` de novo.
        setTela({ fase: "link-invalido" });
      } else {
        // I9: o `429` vem do throttler em inglês; a tela diz o texto fixo.
        setErro(
          ehMuitasTentativas(e)
            ? TEXTO_DE_MUITAS_TENTATIVAS
            : e instanceof ApiError
              ? e.message
              : "Não foi possível redefinir sua senha. Tente de novo.",
        );
      }
      setEnviando(false);
      return;
    }
    // O botão continua desabilitado até a navegação: um segundo toque
    // mandaria o link já gasto e mostraria o `410` a quem acabou de dar certo.
    router.replace(LOGIN_APOS_REDEFINICAO);
  }

  if (tela.fase === "carregando") {
    return (
      <p className="text-center text-sm text-[var(--color-on-surface-variant)]">
        Carregando...
      </p>
    );
  }

  if (tela.fase === "link-invalido") {
    return (
      <div className="flex flex-col gap-4 text-center">
        <p role="alert" className="text-sm text-[var(--color-on-surface-variant)]">
          {TEXTO_LINK_DE_REDEFINICAO_INVALIDO}
        </p>
        <Button asChild className="h-12 text-sm font-bold">
          <Link href="/esqueci-senha">Pedir outro link</Link>
        </Button>
      </div>
    );
  }

  if (tela.fase === "falha-ao-abrir") {
    return (
      <div className="flex flex-col gap-4 text-center">
        <p role="alert" className="text-sm text-[var(--color-error)]">
          {tela.muitasTentativas
            ? TEXTO_DE_MUITAS_TENTATIVAS
            : "Não foi possível abrir o link. Tente de novo."}
        </p>
        <Button
          type="button"
          variant="outline"
          className="h-12"
          onClick={() => {
            setTela({ fase: "carregando" });
            setTentativa((n) => n + 1);
          }}
        >
          Tentar de novo
        </Button>
      </div>
    );
  }

  const { conta } = tela;

  return (
    <form onSubmit={(e) => void handleSubmit(e, conta)} className="flex flex-col gap-4" noValidate>
      <div
        data-conta-da-redefinicao=""
        className="flex items-center gap-3 rounded-lg bg-[var(--color-primary-container)]/40 p-3"
      >
        <span aria-hidden="true" className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-white p-1">
          <LogoDaEmpresa url={conta.empresa.logoUrl} nome={conta.empresa.nome} className="size-10" />
        </span>
        <span className="flex min-w-0 flex-col gap-0.5">
          {/* React escapa o texto: o nome vem do banco e nunca vira HTML. */}
          <span className="text-sm leading-snug font-extrabold break-words">{conta.empresa.nome}</span>
          <span className="text-sm leading-snug text-[var(--color-on-surface-variant)]">
            {NOME_DO_PAPEL[conta.papel]}
          </span>
        </span>
      </div>

      <CampoSenha
        id="senha"
        label="Senha nova"
        valor={senha}
        onChange={setSenha}
        disabled={enviando}
      />
      <CampoSenha
        id="confirmacao"
        label="Repita a senha nova"
        valor={confirmacao}
        onChange={setConfirmacao}
        disabled={enviando}
      />

      {erro ? (
        <p role="alert" className="text-sm text-[var(--color-error)]">
          {erro}
        </p>
      ) : null}

      <Button type="submit" disabled={enviando} className="mt-2 h-12 text-sm font-bold">
        {enviando ? "Salvando..." : "Redefinir minha senha"}
      </Button>
    </form>
  );
}
