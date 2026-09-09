"use client";

import { useEffect, useState } from "react";
import {
  ApiError,
  getDisponibilidadeDoProfessor,
  salvarDisponibilidadeDoProfessor,
  type DiaDeDisponibilidade,
} from "@/lib/api-client";
import { DIAS_SEMANA } from "@/lib/dias-semana";
import { Button } from "@/components/ui/button";
import { FormCard } from "@/components/form-card";

/**
 * SPEC-040/TASK-003 — a semana em que o professor atende, na ficha dele.
 *
 * ## Por que aqui, e não numa tela própria
 *
 * Mesma razão da carteira e da frequência do aluno: quem configura a agenda
 * está olhando para uma pessoa. Uma tela "disponibilidades" obrigaria a
 * escolher o professor de novo, depois de já tê-lo escolhido.
 *
 * ## A grade edita os sete dias, e o `PUT` manda só os atendidos
 *
 * O `GET` devolve sempre sete (AC-007) para que esta tela não precise saber
 * que ausência de linha significa "não atende". O `PUT` recebe **só os dias
 * atendidos** (D6) — não existe campo de flag no corpo. A assimetria é
 * deliberada e está em `API_CONTRACTS.md`; aqui ela custa um `filter`.
 *
 * ## As horas só existem em hora cheia
 *
 * O `<select>` só oferece `00:00`–`23:00`, então `HORA_NAO_CHEIA` não
 * deveria chegar do servidor — **e mesmo assim o erro é tratado.** Um
 * `<select>` é impedimento de interface, não garantia: o back tem a regra e
 * o banco tem o `CHECK`, e esta tela é a terceira rede, não a única.
 */

/** As horas cheias do dia, que é tudo o que a AC-004 permite. */
const HORAS = Array.from(
  { length: 24 },
  (_, h) => `${String(h).padStart(2, "0")}:00`,
);

/** O estado editável de um dia — o que a grade manipula. */
interface Linha {
  atende: boolean;
  horaInicio: string;
  horaFim: string;
}

/** Um dia recém-marcado nasce num expediente plausível, não em `00:00`. */
const PADRAO: Linha = { atende: true, horaInicio: "08:00", horaFim: "12:00" };

function daResposta(dias: DiaDeDisponibilidade[]): Linha[] {
  return DIAS_SEMANA.map((_, i) => {
    const d = dias.find((x) => x.diaSemana === i);
    if (!d || d.indisponivel) {
      return { atende: false, horaInicio: PADRAO.horaInicio, horaFim: PADRAO.horaFim };
    }
    return {
      atende: true,
      horaInicio: d.horaInicio ?? PADRAO.horaInicio,
      horaFim: d.horaFim ?? PADRAO.horaFim,
    };
  });
}

export function DisponibilidadeDoProfessor({ professorId }: { professorId: string }) {
  const [linhas, setLinhas] = useState<Linha[] | null>(null);
  const [erroDeCarga, setErroDeCarga] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState(false);

  // Mesmo desenho de `carteira-do-aluno.tsx`: a bandeira `vivo` evita gravar
  // estado depois de o componente sair.
  useEffect(() => {
    let vivo = true;
    getDisponibilidadeDoProfessor(professorId)
      .then((d) => vivo && setLinhas(daResposta(d)))
      .catch(() => vivo && setErroDeCarga(true));
    return () => {
      vivo = false;
    };
  }, [professorId]);

  function alterar(i: number, mudanca: Partial<Linha>) {
    setSucesso(false);
    setErro(null);
    setLinhas((atual) =>
      atual ? atual.map((l, j) => (j === i ? { ...l, ...mudanca } : l)) : atual,
    );
  }

  async function salvar() {
    if (!linhas) return;
    setErro(null);
    setSucesso(false);

    // A mesma regra do back (AC-003), aqui só para não gastar uma viagem: o
    // servidor continua sendo quem decide, e o erro dele é tratado abaixo.
    const invalido = linhas.findIndex((l) => l.atende && l.horaFim <= l.horaInicio);
    if (invalido >= 0) {
      setErro(`${DIAS_SEMANA[invalido]}: o fim precisa ser depois do início.`);
      return;
    }

    setSalvando(true);
    try {
      const resposta = await salvarDisponibilidadeDoProfessor(
        professorId,
        linhas
          .map((l, i) => ({ ...l, diaSemana: i }))
          .filter((l) => l.atende)
          .map(({ diaSemana, horaInicio, horaFim }) => ({
            diaSemana,
            horaInicio,
            horaFim,
          })),
      );
      // Relê do que o servidor devolveu, e não do estado local: se ele
      // normalizar alguma coisa, a tela mostra o que ficou gravado.
      setLinhas(daResposta(resposta));
      setSucesso(true);
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : "Não foi possível salvar.");
    } finally {
      setSalvando(false);
    }
  }

  if (erroDeCarga) {
    return (
      <FormCard title="Disponibilidade" className="max-w-2xl">
        <p className="text-sm text-[var(--color-error)]">
          Não foi possível carregar a disponibilidade deste professor.
        </p>
      </FormCard>
    );
  }

  if (!linhas) {
    return (
      <FormCard title="Disponibilidade" className="max-w-2xl">
        <p className="text-sm text-[var(--color-on-surface-variant)]">Carregando...</p>
      </FormCard>
    );
  }

  return (
    <FormCard
      title="Disponibilidade"
      description="Os horários em que este professor atende. Dia desmarcado significa que ele não atende — não há agenda para ele nesse dia."
      className="max-w-2xl"
    >
      <div className="flex flex-col gap-3">
        {linhas.map((linha, i) => (
          <div
            key={DIAS_SEMANA[i]}
            className="flex flex-wrap items-center gap-3 border-b border-border pb-3 last:border-b-0"
          >
            <label className="flex min-w-[160px] items-center gap-2 text-sm font-semibold text-[var(--color-on-surface)]">
              <input
                type="checkbox"
                checked={linha.atende}
                aria-label={`Atende ${DIAS_SEMANA[i]}`}
                onChange={(e) => alterar(i, { atende: e.target.checked })}
                className="size-4 accent-[var(--color-primary)]"
              />
              {DIAS_SEMANA[i]}
            </label>

            {linha.atende ? (
              <div className="flex items-center gap-2">
                <select
                  aria-label={`Início ${DIAS_SEMANA[i]}`}
                  value={linha.horaInicio}
                  onChange={(e) => alterar(i, { horaInicio: e.target.value })}
                  className="h-10 rounded-[var(--radius-field)] border border-border bg-transparent px-3 text-sm"
                >
                  {HORAS.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
                <span className="text-sm text-[var(--color-on-surface-variant)]">até</span>
                <select
                  aria-label={`Fim ${DIAS_SEMANA[i]}`}
                  value={linha.horaFim}
                  onChange={(e) => alterar(i, { horaFim: e.target.value })}
                  className="h-10 rounded-[var(--radius-field)] border border-border bg-transparent px-3 text-sm"
                >
                  {HORAS.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <span className="text-sm text-[var(--color-on-surface-variant)]">Não atende</span>
            )}
          </div>
        ))}
      </div>

      {erro ? <p className="mt-4 text-sm text-[var(--color-error)]">{erro}</p> : null}
      {sucesso ? (
        <p className="mt-4 text-sm text-[var(--color-primary)]">Disponibilidade salva.</p>
      ) : null}

      <div className="mt-6 flex justify-end border-t border-border pt-6">
        <Button
          type="button"
          disabled={salvando}
          onClick={() => void salvar()}
          className="h-11 px-6 text-[13px] font-semibold"
        >
          {salvando ? "Salvando..." : "Salvar disponibilidade"}
        </Button>
      </div>
    </FormCard>
  );
}
