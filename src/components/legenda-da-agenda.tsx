"use client";

import { Check, X } from "lucide-react";
import { ICONE_DO_TIPO } from "@/components/bloco-da-agenda";
import type { Court } from "@/lib/api-client";
import {
  BORDA_DO_ESTADO,
  NOMES_DAS_CORES,
  ROTULO_DO_ESTADO,
  ROTULO_DO_TIPO,
  rotuloDaQuadra,
  type EstadoVisual,
  type TipoVisual,
} from "@/lib/visual-da-agenda";

const TIPOS: TipoVisual[] = ["TURMA", "AVULSO", "PARTICULAR"];
const ESTADOS: EstadoVisual[] = ["programada", "pago", "pendente", "cancelada"];

/**
 * SPEC-057/TASK-005/D19 — **a legenda da agenda, fora da grade.**
 *
 * Fora, e não dentro, porque a grade rola na horizontal a 320 px: uma legenda
 * dentro dela sumiria junto com as colunas. Ela explica exatamente as formas
 * que `BlocoDaAgenda` aplica — os rótulos, ícones e bordas vêm dos mesmos
 * mapas — e lista cada quadra por **nome + código + nome da cor**. A amostra
 * de cor é decorativa: a identificação está no texto.
 *
 * Fecha a LIM-052c (a agenda do gestor não tinha legenda).
 */
export function LegendaDaAgenda({ quadras }: { quadras: Court[] }) {
  return (
    <section
      aria-label="Legenda da agenda"
      className="flex flex-col gap-3 rounded-2xl border border-border bg-[var(--color-surface)] p-4 text-sm"
    >
      <div className="flex flex-wrap gap-x-6 gap-y-2">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="font-medium">Tipo:</span>
          {TIPOS.map((tipo) => {
            const Icone = ICONE_DO_TIPO[tipo];
            return (
              <span key={tipo} className="inline-flex items-center gap-1">
                <Icone aria-hidden="true" className="size-4" />
                {ROTULO_DO_TIPO[tipo]}
              </span>
            );
          })}
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="font-medium">Estado:</span>
          {ESTADOS.map((estado) => (
            <span key={estado} className="inline-flex items-center gap-1">
              <span
                aria-hidden="true"
                className={`inline-block h-4 w-6 rounded border-2 border-[#12160F] bg-white ${
                  BORDA_DO_ESTADO[estado] === "tracejada"
                    ? "border-dashed"
                    : "border-solid"
                }`}
              />
              {estado === "cancelada" ? (
                <X aria-hidden="true" className="size-4" />
              ) : estado === "pago" ? (
                <Check aria-hidden="true" className="size-4" />
              ) : null}
              {ROTULO_DO_ESTADO[estado]}
            </span>
          ))}
        </div>
      </div>

      {quadras.length > 0 ? (
        <ul aria-label="Quadras" className="flex flex-wrap gap-x-4 gap-y-1">
          {quadras.map((q) => (
            <li key={q.id} className="inline-flex items-center gap-1.5 break-words">
              <span
                data-amostra
                aria-hidden="true"
                className="inline-block size-3 shrink-0 rounded-full"
                style={{ backgroundColor: q.cor }}
              />
              <span>{rotuloDaQuadra(q.nome, q.codigoAgenda)}</span>
              <span className="text-[var(--color-on-surface-variant)]">
                {NOMES_DAS_CORES[q.cor]}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
