import { AbasDoGrupo } from "@/components/abas-do-grupo";
import { TiposDeAdicionalManager } from "@/components/tipos-de-adicional-manager";

/**
 * SPEC-054/D12 — os tipos de adicional: o catálogo livre que agrupa os
 * adicionais. **SPEC-080 — a segunda aba do grupo Adicionais** (card 5360).
 */
export default function TiposDeAdicionalPage() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8">
      <AbasDoGrupo grupo="adicionais" />
      <TiposDeAdicionalManager />
    </div>
  );
}
