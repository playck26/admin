"use client";

import { CalendarDays, Check, User, Users, X } from "lucide-react";
import type { ItemDoDia } from "@/lib/api-client";
import {
  BORDA_DO_ESTADO,
  ROTULO_DO_ESTADO,
  ROTULO_DO_TIPO,
  SUBSTRATO_DO_BLOCO,
  TEXTO_DO_BLOCO,
  estadoDoItem,
  lotacaoDaAula,
  rotuloDaQuadra,
} from "@/lib/visual-da-agenda";

/** Ícone por tipo — forma que distingue sem cor (D19). */
export const ICONE_DO_TIPO = {
  TURMA: Users,
  AVULSO: CalendarDays,
  PARTICULAR: User,
} as const;

/**
 * SPEC-057/TASK-005/D19 — **um item na grade da semana.**
 *
 * As regras de desenho, com o porquê de cada uma:
 *
 * - **substrato branco opaco e texto escuro FIXOS**, em qualquer tema e
 *   estado. O contraste das seis cores da paleta foi calculado contra
 *   `#FFFFFF`; um fundo que mudasse com o tema invalidaria a conta;
 * - **a cor da quadra é um marcador de 4 px**, separado do texto por espaço
 *   branco e `aria-hidden` — nunca fundo, nunca texto (INV-140);
 * - **nenhuma `opacity`** no bloco: ela mistura o substrato com o que está
 *   atrás e derruba o contraste medido. O hover sublinha; o foco ganha
 *   contorno por fora;
 * - **nada é cortado**: nome de quadra longo quebra linha, e o `Q-<código>` e
 *   o estado nunca somem num `truncate` — são eles que identificam;
 * - **alvo de 44 px** de altura mínima (`min-h-11`).
 */
export function BlocoDaAgenda({
  item,
  onClick,
}: {
  item: ItemDoDia;
  onClick: () => void;
}) {
  const estado = estadoDoItem(item);
  const Icone = ICONE_DO_TIPO[item.tipoVisual];
  const lotacao = lotacaoDaAula(item);

  return (
    <button
      type="button"
      onClick={onClick}
      style={{ backgroundColor: SUBSTRATO_DO_BLOCO, color: TEXTO_DO_BLOCO }}
      className={`mb-1 flex min-h-11 w-full gap-1.5 rounded-md border-2 px-1.5 py-1 text-left text-xs hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#12160F] ${
        BORDA_DO_ESTADO[estado] === "tracejada" ? "border-dashed" : "border-solid"
      } border-[#12160F]`}
    >
      <span
        data-marcador-da-quadra
        aria-hidden="true"
        className="w-1 shrink-0 self-stretch rounded-full"
        style={{ backgroundColor: item.quadraCor }}
      />
      <span className="flex min-w-0 flex-col gap-0.5 break-words">
        <span className="font-semibold">
          {item.horaInicio}–{item.horaFim}
        </span>
        <span>{item.responsavel ?? "sem responsável"}</span>
        <span className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
          <span className="inline-flex items-center gap-0.5">
            <Icone aria-hidden="true" className="size-3.5 shrink-0" />
            {ROTULO_DO_TIPO[item.tipoVisual]}
          </span>
          <span className="inline-flex items-center gap-0.5 font-medium">
            {estado === "cancelada" ? (
              <X aria-hidden="true" className="size-3.5 shrink-0" />
            ) : estado === "pago" ? (
              <Check aria-hidden="true" className="size-3.5 shrink-0" />
            ) : null}
            {ROTULO_DO_ESTADO[estado]}
          </span>
        </span>
        {lotacao ? <span>{lotacao}</span> : null}
        <span>{rotuloDaQuadra(item.quadraNome, item.quadraCodigoAgenda)}</span>
      </span>
    </button>
  );
}
