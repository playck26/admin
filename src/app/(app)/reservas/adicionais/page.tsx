import { AbasDoGrupo } from "@/components/abas-do-grupo";
import { AdicionaisManager } from "@/components/adicionais-manager";

/**
 * SPEC-054/D12 — os adicionais do clube: preço, estoque, tipo e oferta.
 *
 * Fica sob `/reservas` porque adicional é da reserva, não da quadra: o mesmo
 * item vale para reserva de quadra e para aula particular.
 *
 * **SPEC-080 — é a primeira aba do grupo Adicionais** (card 5360).
 */
export default function AdicionaisPage() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8">
      <AbasDoGrupo grupo="adicionais" />
      <AdicionaisManager />
    </div>
  );
}
