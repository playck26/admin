import type { AdicionalDaReserva } from "@/lib/api-client";

/**
 * SPEC-054/D12 — os adicionais de uma reserva, numa linha: `2× Raquete, 1× Bola`.
 *
 * Aceita `undefined` de propósito: durante o rollout, o `back` anterior à
 * SPEC-054 não manda o campo, e a tela não pode quebrar por isso.
 */
export function ItensDaReserva({
  adicionais,
}: {
  adicionais: readonly AdicionalDaReserva[] | undefined;
}) {
  if (!adicionais || adicionais.length === 0) return null;
  return (
    <span className="text-xs text-[var(--color-on-surface-variant)]">
      {adicionais.map((a) => `${a.quantidade}× ${a.nome}`).join(", ")}
    </span>
  );
}
