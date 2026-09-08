"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ApiError,
  getExtratoDeCredito,
  lancarCredito,
  type ExtratoDeCredito,
} from "@/lib/api-client";
import { CampoSenha } from "@/components/campo-senha";

/**
 * SPEC-033/TASK-007 — a carteira do aluno, na ficha dele.
 *
 * ## Por que aqui, e não numa tela própria
 *
 * Quem lança crédito está olhando para uma pessoa, não para uma carteira. É
 * o mesmo motivo pelo qual a frequência (SPEC-015) mora nesta ficha: o gestor
 * chega pelo aluno e precisa decidir sobre ele — obrigar a navegar para outra
 * tela transformaria "ver e lançar" em duas viagens.
 *
 * ## A senha é pedida a CADA lançamento, e isso é a decisão (D6)
 *
 * Não há sessão elevada. O campo nasce vazio, nunca é guardado, e é limpo
 * depois de cada envio — inclusive quando dá certo. Quem quiser lançar duas
 * vezes digita duas vezes, e isso é o ponto: dinheiro entrando e saindo da
 * carteira de outra pessoa não pode depender de "eu já confirmei há pouco".
 *
 * ## O erro vai para o campo certo, e por `code` (não por texto)
 *
 * `SENHA_INVALIDA` é erro do campo de senha; `SALDO_INSUFICIENTE`, do valor.
 * Casar mensagem para distinguir os dois seria retrocesso — é a mesma razão
 * pela qual o back parou de discriminar por texto no D7.
 */
export function CarteiraDoAluno({ alunoId }: { alunoId: string }) {
  const [dados, setDados] = useState<ExtratoDeCredito | null>(null);
  const [erroDeCarga, setErroDeCarga] = useState(false);

  const [tipo, setTipo] = useState<"entrada" | "retirada">("entrada");
  const [valor, setValor] = useState("");
  const [motivo, setMotivo] = useState("");
  const [senha, setSenha] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<{ campo: Campo; texto: string } | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    try {
      setDados(await getExtratoDeCredito(alunoId));
      setErroDeCarga(false);
    } catch {
      setErroDeCarga(true);
    }
  }, [alunoId]);

  // Mesmo desenho de `frequencia-aluno.tsx`: a bandeira `vivo` evita gravar
  // estado depois de o componente sair, e a promessa mantém o `setState` fora
  // do corpo síncrono do efeito — que é o que a regra
  // `react-hooks/set-state-in-effect` cobra.
  useEffect(() => {
    let vivo = true;
    getExtratoDeCredito(alunoId)
      .then((d) => vivo && setDados(d))
      .catch(() => vivo && setErroDeCarga(true));
    return () => {
      vivo = false;
    };
  }, [alunoId]);

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault();
    setErro(null);
    setSucesso(null);

    const centavos = paraCentavos(valor);
    if (centavos === null) {
      setErro({ campo: "valor", texto: "Informe um valor maior que zero." });
      return;
    }
    if (!motivo.trim()) {
      setErro({ campo: "motivo", texto: "O motivo é obrigatório." });
      return;
    }
    if (!senha) {
      setErro({ campo: "senha", texto: "Confirme com a sua senha." });
      return;
    }

    setEnviando(true);
    try {
      await lancarCredito(alunoId, {
        tipo,
        valorCentavos: centavos,
        motivo: motivo.trim(),
        senha,
      });
      setValor("");
      setMotivo("");
      setSucesso(
        tipo === "entrada" ? "Crédito lançado." : "Crédito retirado.",
      );
      await carregar();
    } catch (e) {
      setErro({
        campo: campoDoErro(e),
        texto:
          e instanceof ApiError ? e.message : "Não foi possível registrar.",
      });
    } finally {
      // **Sempre**, inclusive no sucesso: a senha não sobrevive ao envio.
      setSenha("");
      setEnviando(false);
    }
  }

  if (erroDeCarga) {
    return (
      <p className="text-sm text-[var(--color-error)]">
        Não foi possível carregar a carteira deste aluno. Recarregue a página.
      </p>
    );
  }
  if (!dados) {
    return (
      <p className="text-sm text-[var(--color-on-surface-variant)]">
        Carregando carteira…
      </p>
    );
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold text-[var(--color-on-surface)]">
          Carteira
        </h2>
        <span
          className="text-xl font-semibold text-[var(--color-on-surface)]"
          data-testid="saldo-da-carteira"
        >
          {emReais(dados.saldoCentavos)}
        </span>
      </div>

      <form onSubmit={enviar} className="flex flex-col gap-3">
        <div className="flex gap-2">
          {(["entrada", "retirada"] as const).map((t) => (
            <button
              key={t}
              type="button"
              aria-pressed={tipo === t}
              onClick={() => setTipo(t)}
              className={`rounded-full px-4 py-1.5 text-sm ${
                tipo === t
                  ? "bg-[var(--color-primary)] text-[var(--color-on-primary)]"
                  : "bg-[var(--color-surface-variant)] text-[var(--color-on-surface-variant)]"
              }`}
            >
              {t === "entrada" ? "Lançar" : "Retirar"}
            </button>
          ))}
        </div>

        <label className="flex flex-col gap-1 text-sm">
          Valor
          <input
            inputMode="decimal"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            placeholder="0,00"
            aria-label="Valor"
            className="rounded-md border border-[var(--color-outline)] px-3 py-2"
          />
        </label>
        {erro?.campo === "valor" && <Erro texto={erro.texto} />}

        <label className="flex flex-col gap-1 text-sm">
          Motivo
          <input
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            aria-label="Motivo"
            maxLength={500}
            className="rounded-md border border-[var(--color-outline)] px-3 py-2"
          />
          {/* AC-013: o aluno não vê este campo. Dizer isso aqui muda o que se
              escreve — e é justamente o que faz o registro valer. */}
          <span className="text-xs text-[var(--color-on-surface-variant)]">
            Nota interna do clube. O aluno não vê.
          </span>
        </label>
        {erro?.campo === "motivo" && <Erro texto={erro.texto} />}

        <CampoSenha
          id="senha-do-lancamento"
          label="Sua senha"
          valor={senha}
          onChange={setSenha}
          disabled={enviando}
          autoComplete="current-password"
          placeholder="A senha que você usa para entrar"
        />
        {erro?.campo === "senha" && <Erro texto={erro.texto} />}
        {erro?.campo === "geral" && <Erro texto={erro.texto} />}
        {sucesso && (
          <p className="text-sm text-[var(--color-primary)]" role="status">
            {sucesso}
          </p>
        )}

        <button
          type="submit"
          disabled={enviando}
          className="self-start rounded-full bg-[var(--color-primary)] px-5 py-2 text-sm text-[var(--color-on-primary)] disabled:opacity-60"
        >
          {enviando ? "Registrando…" : "Registrar"}
        </button>
      </form>

      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-medium text-[var(--color-on-surface-variant)]">
          Extrato
        </h3>
        {dados.movimentos.length === 0 ? (
          <p className="text-sm text-[var(--color-on-surface-variant)]">
            Nenhum movimento ainda.
          </p>
        ) : (
          <ul className="flex flex-col gap-1">
            {dados.movimentos.map((m) => (
              <li
                key={m.id}
                className="flex items-baseline justify-between gap-3 border-b border-[var(--color-outline-variant)] py-1.5 text-sm"
              >
                <span>
                  {ROTULO[m.tipo] ?? m.tipo}
                  {m.motivo ? (
                    <span className="text-[var(--color-on-surface-variant)]">
                      {" "}
                      — {m.motivo}
                    </span>
                  ) : null}
                </span>
                <span
                  className={
                    SOMA.has(m.tipo)
                      ? "text-[var(--color-primary)]"
                      : "text-[var(--color-on-surface)]"
                  }
                >
                  {SOMA.has(m.tipo) ? "+" : "−"} {emReais(m.valorCentavos)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

type Campo = "valor" | "motivo" | "senha" | "geral";

function Erro({ texto }: { texto: string }) {
  return (
    <p role="alert" className="text-sm text-[var(--color-error)]">
      {texto}
    </p>
  );
}

/**
 * O `code` decide o campo. Sem ele, `geral`.
 *
 * `SALDO_INSUFICIENTE` aponta para o **valor** porque é o valor que está
 * grande demais — mandar a pessoa olhar a senha seria mentir sobre a causa.
 */
function campoDoErro(e: unknown): Campo {
  if (!(e instanceof ApiError)) return "geral";
  if (e.code === "SENHA_INVALIDA") return "senha";
  if (e.code === "SALDO_INSUFICIENTE") return "valor";
  if (e.code === "MOTIVO_OBRIGATORIO") return "motivo";
  return "geral";
}

/**
 * "12,34" e "12.34" viram 1234. Devolve `null` quando não é valor positivo.
 *
 * **Arredonda no fim, e de propósito:** `parseFloat("12,345") * 100` dá
 * 1234.4999… em ponto flutuante, e truncar produziria 1234 onde a pessoa
 * digitou 12,35. O back recusa não-inteiro de todo jeito (`@IsInt`), mas
 * mandar o número errado transformaria erro de digitação em `400` sem
 * explicação.
 */
function paraCentavos(texto: string): number | null {
  const limpo = texto.replace(/\s/g, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(limpo)) return null;
  const centavos = Math.round(Number(limpo) * 100);
  return centavos > 0 ? centavos : null;
}

function emReais(centavos: number): string {
  return (centavos / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

const ROTULO: Record<string, string> = {
  entrada: "Lançamento",
  retirada: "Retirada",
  consumo: "Reserva",
  devolucao: "Estorno de reserva",
};

/** Quem soma no saldo (D3 — o sinal vem do tipo, nunca do valor). */
const SOMA = new Set(["entrada", "devolucao"]);
