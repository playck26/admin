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
export function PrazosDeCancelamentoCard() {
  const [carregado, setCarregado] = useState(false);
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
          e instanceof ApiError ? e.message : "Não foi possível carregar.",
        );
        // **Carrega mesmo assim**, com os dois campos vazios. Esconder o
        // cartão por causa de uma leitura que falhou deixaria o gestor sem
        // caminho nenhum — e "sem prazo" é o estado real de quem nunca
        // configurou, então o formulário vazio não mente sobre nada.
        setCarregado(true);
      });
  }, [aplicar]);

  /**
   * `null` para vazio; `NaN` para o que não é inteiro `>= 1`.
   *
   * O servidor recusa zero, negativo e fracionário com `400` (AC-002) — esta
   * checagem não substitui a de lá, antecipa. Descobrir "zero não vale" por
   * um erro de rede é pior do que ler antes de tentar.
   */
  const emHoras = (v: string): number | null | typeof NaN => {
    const limpo = v.trim();
    if (limpo === "") return null;
    const n = Number(limpo);
    return Number.isInteger(n) && n >= 1 ? n : NaN;
  };

  async function salvar() {
    setErro(null);
    setSalvo(false);

    const a = emHoras(aula);
    const r = emHoras(reserva);
    if (Number.isNaN(a) || Number.isNaN(r)) {
      setErro(
        'O prazo começa em 1 hora, e é número inteiro. Para não exigir antecedência, deixe o campo vazio — zero seria "só até a hora de começar", que é o que já vale sempre.',
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
      <input
        id={id}
        type="number"
        min={1}
        step={1}
        inputMode="numeric"
        placeholder="Sem prazo"
        value={valor}
        onChange={(e) => {
          setValor(e.target.value);
          setSalvo(false);
        }}
        className="h-11 w-40 rounded-lg border border-[var(--color-outline)] bg-[var(--color-surface)] px-3 text-[15px]"
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
              disabled={salvando}
              onClick={() => void salvar()}
              className="h-11 rounded-lg bg-[var(--color-primary)] px-5 text-[15px] font-bold text-[var(--color-on-primary)] disabled:opacity-60"
            >
              {salvando ? "Salvando..." : "Salvar"}
            </button>
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
