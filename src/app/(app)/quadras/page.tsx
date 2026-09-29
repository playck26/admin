import { AbasDoGrupo } from "@/components/abas-do-grupo";
import { CourtsList } from "@/components/courts-list";

/** SPEC-080 — a aba Quadras do grupo Quadras (o card 5360). */
export default function QuadrasPage() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <AbasDoGrupo grupo="quadras" />
      <CourtsList />
    </div>
  );
}
