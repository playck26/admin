import { CaixaDeAvisos } from "@/components/caixa-de-avisos";

/**
 * SPEC-065 — **a caixa de avisos do gestor.**
 *
 * Destino do sino que era inerte desde a SPEC-008.
 */
export default function AvisosPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <CaixaDeAvisos />
    </div>
  );
}
