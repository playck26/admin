import { TiposDeAdicionalManager } from "@/components/tipos-de-adicional-manager";

/** SPEC-054/D12 — os tipos de adicional: o catálogo livre que agrupa os adicionais. */
export default function TiposDeAdicionalPage() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8">
      <TiposDeAdicionalManager />
    </div>
  );
}
