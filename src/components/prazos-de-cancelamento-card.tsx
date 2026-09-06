"use client";

import { useCallback, useEffect, useState } from "react";
import { Clock } from "lucide-react";
import {
  ApiError,
  definirConfigOperacao,
  getConfigOperacao,
  type ConfigOperacao,
} from "@/lib/api-client";

/**
 * SPEC-031/REQ-001 — **com quanta antecedência o aluno pode desistir.**
 *
 * Dois prazos, em horas: um para sair de turma, outro para cancelar reserva
 * de quadra. São separados de propósito — a turma tem professor contratado
 * para a hora, a quadra não; o clube que quer 24h para uma e 2h para a outra
 * não precisa escolher o pior dos dois.
 *
 * ## Vazio é "sem prazo", e é o padrão
 *
 * Empresa que nunca configurou nada não passa a exigir antecedência nenhuma.
 * Um número padrão qualquer seria regra inventada por nós entrando em vigor
 * sem ninguém pedir — mesma decisão do limite de turmas (SPEC-023).
 *
 * E vazio precisa ser **alcançável de volta**: quem pôs 24h e se arrependeu
 * apaga o campo. Por isso o estado do formulário é `string`, não `number`: com
 * número, "apagar" e "zero" viram a mesma coisa na hora de mandar.
 *
 * ## O que a tela diz que NÃO é sobre prazo
 *
 * A SPEC-031 muda **uma** coisa para quem nunca configurou nada: cancelar
 * **depois de a aula começar** passa a ser recusado, em qualquer configuração
 * (D5b). Isso não é o prazo — é o corte de `minutos <= 0`, e vale mesmo com os
 * dois campos vazios.
 *
 * **Está escrito na tela porque é a única mudança de comportamento que o
 * clube não pediu.** Sem isso, o gestor descobre pela reclamação do aluno, e
 * a explicação chega depois do problema.
 */
/**
 * O teto real, e ele existe no banco: a coluna é `INTEGER` (INT4). Acima
 * disso o valor passava nas DUAS validações — a local e o `@Min(1)` do DTO,
 * que não tem `@Max` — e morria no Prisma, virando erro genérico em vez de
 * `400`. Nem o AC-002 nem o DTO declaravam o teto; agora um dos dois lados
 * declara.
 */
const TETO = 2_147_483_647;

export function PrazosDeCancelamentoCard() {
  const [carregado, setCarregado] = useState(false);
  /**
   * **A leitura falhou, e por isso o formulario NAO pode gravar.**
   *
   * Achado de auditoria adversarial, 2026-09-05, e era perda de dado real:
   * o `PUT` deste endpoint e **substituicao total** — manda os dois campos
   * sempre. Com a leitura falhada os dois campos ficam vazios, e vazio quer
   * dizer `null`. O gestor digitava um prazo, salvava, e **apagava o outro**,
   * recebendo "Salvo." como resposta.
   *
   * O erro anterior nao foi mostrar o cartao: foi nao distinguir *"vazio
   * porque o clube nunca configurou"* de *"vazio porque eu nao consegui ler"*.
   * Os dois desenham a mesma tela e significam o oposto.
   */
  const [leituraFalhou, setLeituraFalhou] = useState(false);
  const [tentativa, setTentativa] = useState(0);
  const [aula, setAula] = useState("");
  const [reserva, setReserva] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);

  // `useCallback` com deps vazias porque os setters do `useState` são
  // estáveis: sem isso `aplicar` nasce nova a cada render e o `useEffect`
  // abaixo ou fica com dependência faltando (o aviso do lint) ou passa a
  // recarregar em loop.
  const aplicar = useCallback((c: ConfigOperacao) => {
    const paraCampo = (n: number | null) => (n === null ? "" : String(n));
    setAula(paraCampo(c.prazoCancelamentoAulaHoras));
    setReserva(paraCampo(c.prazoCancelamentoReservaHoras));
  }, []);

  useEffect(() => {
    getConfigOperacao()
      .then((c) => {
        aplicar(c);
        setCarregado(true);
      })
      .catch((e: unknown) => {
        setErro(
          e instanceof ApiError
            ? `${e.message} Recarregue antes de salvar: sem ler o que está gravado, salvar apagaria o que você não vê.`
            : "Não foi possível carregar. Recarregue antes de salvar: sem ler o que está gravado, salvar apagaria o que você não vê.",
        );
        setLeituraFalhou(true);
        // **Mostra o cartão mesmo assim**, mas em modo somente leitura.
        // Esconder deixaria o gestor sem caminho nenhum; deixar salvar
        // deixaria ele apagar o que não conseguiu ver.
        setCarregado(true);
      });
  }, [aplicar, tentativa]);

  /**
   * Recarregar e a saida do modo somente-leitura, e a unica. Nao existe
   * "salvar assim mesmo": o `PUT` e substituicao total, entao "assim mesmo"
   * significa apagar.
   */
  function recarregar() {
    setErro(null);
    setLeituraFalhou(false);
    setCarregado(false);
    setTentativa((n) => n + 1);
  }

  /**
   * `null` para vazio; `NaN` para o que não é inteiro entre 1 e {@link TETO}.
   *
   * O servidor recusa zero, negativo e fracionário com `400` (AC-002) — esta
   * checagem não substitui a de lá, antecipa. Descobrir "zero não vale" por um
   * erro de rede é pior do que ler antes de tentar.
   *
   * **`/^\d+$/` e não `Number()`.** `Number("0x10")` é 16 e `Number("1e3")` é
   * 1000 — nenhum dos dois é o que quem digitou quis dizer, e os dois passavam
   * na versão anterior. Achado de auditoria.
   */
  const emHoras = (v: string): number | null | typeof NaN => {
    const limpo = v.trim();
    if (limpo === "") return null;
    if (!/^\d+$/.test(limpo)) return NaN;
    const n = Number(limpo);
    return n >= 1 && n <= TETO ? n : NaN;
  };

  async function salvar() {
    // A guarda do achado de auditoria. Ela e redundante com o `disabled` do
    // botao **de proposito**: o `disabled` e a tela nao oferecendo o que
    // seria errado; esta e o codigo nao fazendo o que seria errado. Uma
    // sozinha some no primeiro refactor.
    if (leituraFalhou) return;

    setErro(null);
    setSalvo(false);

    const a = emHoras(aula);
    const r = emHoras(reserva);
    if (Number.isNaN(a) || Number.isNaN(r)) {
      setErro(
        `O prazo é um número inteiro de horas, entre 1 e ${TETO}. Para não exigir antecedência, deixe o campo vazio — zero seria "só até a hora de começar", que é o que já vale sempre.`,
      );
      return;
    }

    setSalvando(true);
    try {
      aplicar(
        await definirConfigOperacao({
          prazoCancelamentoAulaHoras: a as number | null,
          prazoCancelamentoReservaHoras: r as number | null,
        }),
      );
      setSalvo(true);
    } catch (e: unknown) {
      setErro(e instanceof ApiError ? e.message : "Não foi possível salvar.");
    } finally {
      setSalvando(false);
    }
  }

  if (!carregado) {
    return null;
  }

  const campo = (
    id: string,
    rotulo: string,
    valor: string,
    setValor: (v: string) => void,
  ) => (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium" htmlFor={id}>
        {rotulo}
      </label>
      {/*
        **`text`, não `number`, e isso é conserto de achado.** Com
        `type="number"` o browser sanitiza: tudo que ele não considera número
        válido chega ao `onChange` como string **vazia**. Colar "24h", digitar
        "2-4" ou deixar só "-" virava `""` — que aqui significa "sem prazo" —
        e o cartão gravava a remoção do prazo respondendo "Salvo.".

        A validação local se dizia "antecipa o 400 do servidor" e nunca via o
        texto inválido; ela só pegava o que o browser deixava passar como
        número (0, -3, 1.5). `inputMode="numeric"` mantém o teclado numérico
        no celular sem devolver a sanitização.
      */}
      <input
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder="Sem prazo"
        value={valor}
        onChange={(e) => {
          setValor(e.target.value);
          setSalvo(false);
        }}
        disabled={leituraFalhou}
        className="h-11 w-40 rounded-lg border border-[var(--color-outline)] bg-[var(--color-surface)] px-3 text-[15px] disabled:opacity-60"
      />
    </div>
  );

  return (
    <div className="rounded-xl border border-[var(--color-outline)] bg-[var(--color-surface)] p-6">
      <div className="flex items-start gap-3">
        <Clock
          className="mt-0.5 size-5 shrink-0 text-[var(--color-on-surface-variant)]"
          aria-hidden="true"
        />
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-bold">Prazo para desistir</h2>
          <p className="mt-1 text-sm text-[var(--color-on-surface-variant)]">
            Com quanta antecedência o aluno pode sair de uma turma ou cancelar
            uma reserva, em horas. Deixe vazio para não exigir antecedência.
          </p>

          <div className="mt-4 flex flex-wrap items-end gap-4">
            {campo("prazo-aula", "Sair da turma (horas)", aula, setAula)}
            {campo(
              "prazo-reserva",
              "Cancelar reserva (horas)",
              reserva,
              setReserva,
            )}
            <button
              type="button"
              disabled={salvando || leituraFalhou}
              onClick={() => void salvar()}
              className="h-11 rounded-lg bg-[var(--color-primary)] px-5 text-[15px] font-bold text-[var(--color-on-primary)] disabled:opacity-60"
            >
              {salvando ? "Salvando..." : "Salvar"}
            </button>
            {leituraFalhou && (
              <button
                type="button"
                onClick={recarregar}
                className="h-11 rounded-lg border border-[var(--color-outline)] px-5 text-[15px] font-bold"
              >
                Recarregar
              </button>
            )}
            {salvo && (
              <span
                role="status"
                className="pb-3 text-sm font-bold text-[var(--color-on-surface-variant)]"
              >
                Salvo.
              </span>
            )}
          </div>

          {/*
            A única mudança de comportamento que esta configuração impõe a
            quem nunca configurou nada. Ela não depende dos campos acima, e é
            por isso que está escrita separada deles.
          */}
          <p className="mt-4 text-sm text-[var(--color-on-surface-variant)]">
            Depois que a aula ou a reserva começa, cancelar é sempre recusado —
            mesmo com os campos vazios. O prazo diz{" "}
            <strong>quanto antes</strong>; isto diz que{" "}
            <strong>depois do começo não dá</strong>.
          </p>

          {erro ? (
            <p role="alert" className="mt-3 text-sm text-[var(--color-error)]">
              {erro}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
