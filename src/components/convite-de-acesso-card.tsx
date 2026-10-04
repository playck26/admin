"use client";

import { useEffect, useState } from "react";
import { Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  ApiError,
  enviarConviteDeAcesso,
  situacaoDoConvite,
  type PessoaDoConvite,
  type SituacaoDoConvite,
} from "@/lib/api-client";

/**
 * SPEC-083 — por que o envio falhou, em palavras do gestor.
 *
 * Mora aqui e é exportado porque a importação mostra o mesmo motivo na linha
 * convidada que falhou (D10): duas traduções do mesmo código acabariam
 * dizendo coisas diferentes para o mesmo problema.
 *
 * `tempo_esgotado` avisa que pode ter chegado (LIM-083e): o gestor que lesse
 * só "falhou" acharia que a pessoa não recebeu nada, e reenviar é inofensivo,
 * porque revoga aquele link.
 */
export const MOTIVO_DO_ENVIO: Record<
  NonNullable<SituacaoDoConvite["motivo"]>,
  string
> = {
  cota: "o limite diário de e-mails foi atingido; tente amanhã",
  recusado: "o serviço de e-mail recusou o envio",
  indisponivel: "o serviço de e-mail não respondeu",
  tempo_esgotado: "o serviço de e-mail demorou demais (o e-mail pode ter chegado)",
  configuracao: "o envio de e-mail não está configurado",
  sem_confirmacao: "o envio não chegou a ser confirmado",
};

/** Data e hora no fuso do navegador do gestor, como na linha do tempo. */
function quando(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * D9 — o botão de cada situação. **`ativado` não tem botão:** mandar um link
 * que define a senha de quem já tem senha seria recuperação de senha, que a
 * I1 deixou fora (o Back responderia `409 CONTA_JA_ATIVADA`). Quem perdeu a
 * senha tem o "gerar senha temporária" logo ao lado.
 */
const BOTAO: Record<SituacaoDoConvite["situacao"], string | null> = {
  ativado: null,
  sem_conta: "Enviar convite",
  nao_enviado: "Enviar convite",
  enviado: "Reenviar",
  falhou: "Reenviar",
  expirado: "Reenviar",
};

function Situacao({ s }: { s: SituacaoDoConvite }) {
  switch (s.situacao) {
    case "ativado":
      return (
        <>
          <p className="text-sm font-semibold">
            Conta ativada{s.em ? ` em ${quando(s.em)}` : ""}.
          </p>
          <p className="text-sm text-[var(--color-on-surface-variant)]">
            A pessoa já criou a própria senha, e o convite não se aplica.
          </p>
        </>
      );
    case "sem_conta":
      return (
        <>
          <p className="text-sm font-semibold">Sem conta.</p>
          <p className="text-sm text-[var(--color-on-surface-variant)]">
            Enviar o convite cria a conta do professor e manda, para o e-mail
            da ficha, um link para ele criar a própria senha.
          </p>
        </>
      );
    case "nao_enviado":
      return (
        <>
          <p className="text-sm font-semibold">Convite não enviado.</p>
          <p className="text-sm text-[var(--color-on-surface-variant)]">
            O e-mail leva um link de uso único para a pessoa criar a própria
            senha. Ele vale por 7 dias.
          </p>
        </>
      );
    case "enviado":
      return (
        <>
          <p className="text-sm font-semibold">
            Convite enviado{s.em ? ` em ${quando(s.em)}` : ""}.
          </p>
          {/* LIM-083a: "enviado" é "aceito pelo serviço de e-mail". Caixa
              cheia e spam não voltam para o produto, e a frase não pode
              prometer mais que isso. */}
          <p className="text-sm text-[var(--color-on-surface-variant)]">
            {s.expiraEm ? `O link vale até ${quando(s.expiraEm)}. ` : ""}
            Enviado quer dizer aceito pelo serviço de e-mail, não que já chegou.
          </p>
        </>
      );
    case "falhou":
      return (
        <>
          <p className="text-sm font-semibold text-[var(--color-error)]">
            O envio falhou
            {s.motivo ? `: ${MOTIVO_DO_ENVIO[s.motivo]}` : ""}.
          </p>
          <p className="text-sm text-[var(--color-on-surface-variant)]">
            Reenvie o convite, ou gere uma senha temporária e mande pelo
            WhatsApp.
          </p>
        </>
      );
    case "expirado":
      return (
        <>
          <p className="text-sm font-semibold">
            Convite expirado
            {s.expiraEm ? ` em ${quando(s.expiraEm)}` : ""}.
          </p>
          <p className="text-sm text-[var(--color-on-surface-variant)]">
            O link não vale mais. Reenviar manda um link novo, de 7 dias.
          </p>
        </>
      );
  }
}

interface Props {
  pessoa: PessoaDoConvite;
  id: string;
  /**
   * Professor sem e-mail na ficha: sem ele não há para onde mandar, e o Back
   * responderia `400 EMAIL_OBRIGATORIO`. É o e-mail **salvo**, e não o do
   * campo, pela mesma razão do "gerar acesso": é o salvo que vira o login.
   */
  semEmail?: boolean;
  /** Avisa a ficha: o professor sem conta passa a ter conta depois do envio. */
  onEnviado?: (situacao: SituacaoDoConvite) => void;
}

/**
 * SPEC-083/D9, D10 — **o convite por e-mail, na ficha do aluno e na do
 * professor**, ao lado do "gerar senha temporária".
 *
 * Os dois caminhos convivem e um mata o outro sem código novo (D9): usar a
 * senha temporária muda a senha e o link para de valer; usar o link muda a
 * senha e a temporária para de conferir.
 *
 * **O botão fica desabilitado durante o envio.** Um segundo clique emitiria
 * outro convite e revogaria o primeiro, que talvez já esteja na caixa da
 * pessoa: o e-mail que ela abrisse primeiro seria o do link morto.
 */
export function ConviteDeAcessoCard({ pessoa, id, semEmail, onEnviado }: Props) {
  const [situacao, setSituacao] = useState<SituacaoDoConvite | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    situacaoDoConvite(pessoa, id)
      .then((s) => {
        if (vivo) setSituacao(s);
      })
      .catch((err: unknown) => {
        if (vivo)
          setErro(
            err instanceof ApiError
              ? err.message
              : "Não foi possível ler a situação do convite.",
          );
      });
    return () => {
      vivo = false;
    };
  }, [pessoa, id]);

  async function enviar() {
    setErro(null);
    setEnviando(true);
    try {
      const nova = await enviarConviteDeAcesso(pessoa, id);
      setSituacao(nova);
      onEnviado?.(nova);
    } catch (err) {
      // A mensagem do Back inteira: `CONTA_JA_ATIVADA` diz o que fazer (gerar
      // senha temporária), e `EMAIL_EM_USO` diz que a outra conta existe.
      setErro(
        err instanceof ApiError ? err.message : "Não foi possível enviar o convite.",
      );
    } finally {
      setEnviando(false);
    }
  }

  const rotulo = situacao ? BOTAO[situacao.situacao] : null;
  const faltaEmail = semEmail === true && situacao?.situacao === "sem_conta";

  return (
    <div
      data-testid="convite-de-acesso"
      data-situacao={situacao?.situacao ?? ""}
      className="flex flex-col gap-3"
    >
      <div>
        <h3 className="text-sm font-semibold">Convite por e-mail</h3>
      </div>

      {situacao ? (
        <div className="flex flex-col gap-1">
          <Situacao s={situacao} />
        </div>
      ) : erro ? null : (
        <p className="text-sm text-[var(--color-on-surface-variant)]">
          Carregando...
        </p>
      )}

      {erro ? (
        <p role="alert" className="text-sm text-[var(--color-error)]">
          {erro}
        </p>
      ) : null}

      {rotulo ? (
        <div className="flex flex-col gap-2">
          <div>
            <Button
              type="button"
              variant="outline"
              disabled={enviando || faltaEmail}
              onClick={() => void enviar()}
              className="gap-2"
            >
              <Mail className="size-4" />
              {enviando ? "Enviando..." : rotulo}
            </Button>
          </div>
          {faltaEmail ? (
            <p className="text-xs text-[var(--color-on-surface-variant)]">
              Preencha o e-mail acima e salve: ele é o login do professor.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
