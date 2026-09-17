"use client";

import {
  NOMES_DAS_CORES,
  PALETA_DE_QUADRA,
  type CorDeQuadra,
} from "@/lib/visual-da-agenda";

/**
 * SPEC-057/TASK-005/D19 — **a cor da quadra na agenda: seis amostras
 * rotuladas.**
 *
 * Rádios nativos, e não botões pintados, pelo teclado: setas trocam a opção e
 * o leitor de tela anuncia o nome da cor. A amostra é decorativa; o nome é o
 * rótulo. Sem `input[type=color]` nem transparência — o servidor recusa fora
 * da paleta com `400 COR_QUADRA_INVALIDA`, e oferecer seria fazer o gestor
 * descobrir por erro.
 *
 * `valor === ""` significa "não escolhida": o create omite a cor e o banco usa
 * o padrão. Repetir cor entre quadras é permitido — quem desambigua é o
 * código `Q-`.
 */
export function SeletorDeCorDaQuadra({
  valor,
  onChange,
  desabilitado,
}: {
  valor: CorDeQuadra | "";
  onChange: (cor: CorDeQuadra) => void;
  desabilitado?: boolean;
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend id="cor-da-quadra-legenda" className="text-sm font-medium">
        Cor na agenda
      </legend>
      <div
        role="radiogroup"
        aria-labelledby="cor-da-quadra-legenda"
        className="flex flex-wrap gap-2"
      >
        {PALETA_DE_QUADRA.map((cor) => (
          <label
            key={cor}
            className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-border px-3 has-[:checked]:border-2 has-[:checked]:border-[#12160F] has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2"
          >
            <input
              type="radio"
              name="cor-da-quadra"
              value={cor}
              aria-label={NOMES_DAS_CORES[cor]}
              checked={valor === cor}
              onChange={() => onChange(cor)}
              disabled={desabilitado}
              className="sr-only"
            />
            <span
              aria-hidden="true"
              className="inline-block size-5 rounded-full"
              style={{ backgroundColor: cor }}
            />
            <span aria-hidden="true">{NOMES_DAS_CORES[cor]}</span>
          </label>
        ))}
      </div>
      <p className="text-xs text-[var(--color-on-surface-variant)]">
        A cor ajuda a achar a quadra na agenda, mas quem identifica é o nome e o
        código. Sem escolha, a quadra usa o padrão (Verde).
      </p>
    </fieldset>
  );
}
