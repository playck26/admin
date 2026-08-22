"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { DiaHorario, OcupacaoAfetada } from "@/lib/api-client";

const NOMES = [
  "Domingo",
  "Segunda",
  "Terça",
  "Quarta",
  "Quinta",
  "Sexta",
  "Sábado",
];

const HORAS = Array.from({ length: 24 }, (_, h) => `${String(h).padStart(2, "0")}:00`);

/**
 * SPEC-010 — editor de horário de funcionamento, usado tanto para o padrão
 * da empresa quanto para o horário próprio de uma quadra.
 *
 * Só oferece hora cheia (REQ-008/AC-014): o `select` impede o usuário de
 * digitar `07:30` e receber um erro que ele não entenderia — a restrição
 * fica visível na interface em vez de virar validação surpresa.
 */
export function HorariosEditor({
  dias,
  onSalvar,
  salvando,
  rodape,
}: {
  dias: DiaHorario[];
  onSalvar: (dias: DiaHorario[]) => void;
  salvando: boolean;
  rodape?: React.ReactNode;
}) {
  const [estado, setEstado] = useState<DiaHorario[]>(dias);

  function atualizar(diaSemana: number, patch: Partial<DiaHorario>) {
    setEstado((atual) =>
      atual.map((d) => (d.diaSemana === diaSemana ? { ...d, ...patch } : d)),
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col gap-2">
        {[...estado]
          .sort((a, b) => a.diaSemana - b.diaSemana)
          .map((dia) => (
            <li
              key={dia.diaSemana}
              className="flex flex-wrap items-center gap-3 rounded-lg bg-[var(--color-surface-variant)] px-4 py-3"
            >
              <span className="w-24 font-medium">{NOMES[dia.diaSemana]}</span>

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={dia.fechado}
                  disabled={salvando}
                  onChange={(e) =>
                    atualizar(dia.diaSemana, {
                      fechado: e.target.checked,
                      // Ao reabrir um dia, devolve um horário plausível em
                      // vez de campos vazios que o servidor recusaria.
                      horaInicio: e.target.checked ? null : (dia.horaInicio ?? "08:00"),
                      horaFim: e.target.checked ? null : (dia.horaFim ?? "22:00"),
                    })
                  }
                />
                Fechado
              </label>

              {!dia.fechado ? (
                <div className="flex items-center gap-2">
                  <select
                    aria-label={`Abertura de ${NOMES[dia.diaSemana]}`}
                    className="h-10 rounded-md border border-[var(--color-outline)] bg-[var(--color-surface)] px-3"
                    value={dia.horaInicio ?? "08:00"}
                    disabled={salvando}
                    onChange={(e) => atualizar(dia.diaSemana, { horaInicio: e.target.value })}
                  >
                    {HORAS.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                  <span className="text-[var(--color-on-surface-variant)]">até</span>
                  <select
                    aria-label={`Fechamento de ${NOMES[dia.diaSemana]}`}
                    className="h-10 rounded-md border border-[var(--color-outline)] bg-[var(--color-surface)] px-3"
                    value={dia.horaFim ?? "22:00"}
                    disabled={salvando}
                    onChange={(e) => atualizar(dia.diaSemana, { horaFim: e.target.value })}
                  >
                    {HORAS.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <span className="text-sm text-[var(--color-on-surface-variant)]">
                  Sem horários neste dia
                </span>
              )}
            </li>
          ))}
      </ul>

      <div className="flex flex-wrap items-center justify-between gap-3">
        {rodape ?? <span />}
        <Button type="button" disabled={salvando} onClick={() => onSalvar(estado)}>
          {salvando ? "Salvando..." : "Salvar horários"}
        </Button>
      </div>
    </div>
  );
}

/**
 * SPEC-010/REQ-006 — o aviso do que ficou fora.
 *
 * A mudança **foi salva**: isto não é erro, é consequência. O texto diz
 * isso explicitamente, porque um painel vermelho depois de salvar faz
 * qualquer pessoa achar que a operação falhou.
 */
export function AvisoReservasAfetadas({
  afetadasCount,
  amostra,
}: {
  afetadasCount: number;
  amostra: OcupacaoAfetada[];
}) {
  if (afetadasCount === 0) return null;

  return (
    <div className="mt-4 rounded-lg border border-[var(--color-outline)] bg-[var(--color-surface-variant)] p-4">
      <p className="font-medium">
        Horários salvos. {afetadasCount}{" "}
        {afetadasCount === 1 ? "reserva ficou" : "reservas ficaram"} fora do
        novo funcionamento.
      </p>
      <p className="mt-1 text-sm text-[var(--color-on-surface-variant)]">
        Elas continuam valendo — nada foi cancelado. Se a quadra estiver mesmo
        fechada nesses horários, cancele cada uma pela agenda.
      </p>
      <ul className="mt-3 flex flex-col gap-1 text-sm">
        {amostra.map((o, i) => (
          <li key={`${o.data}-${o.horaInicio}-${i}`}>
            {o.quadraNome} — {o.data} às {o.horaInicio}
            {o.responsavel ? ` (${o.responsavel})` : ""}
            {o.origemTipo === "TURMA" ? " · turma" : ""}
          </li>
        ))}
      </ul>
      {afetadasCount > amostra.length ? (
        <p className="mt-2 text-sm text-[var(--color-on-surface-variant)]">
          e mais {afetadasCount - amostra.length}.
        </p>
      ) : null}
    </div>
  );
}
