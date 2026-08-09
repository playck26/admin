import { Badge } from "@/components/ui/badge";

// Badge de status ativo/inativo compartilhado entre as listas (Alunos,
// Professores, Quadras, Turmas) — mesmo par de estado em todas, DESIGN.md
// (referência): pill uppercase 11px bold, container claro da cor do papel.
export function StatusBadge({
  ativo,
  activeLabel = "Ativo",
  inactiveLabel = "Inativo",
}: {
  ativo: boolean;
  activeLabel?: string;
  inactiveLabel?: string;
}) {
  return (
    <Badge
      variant="outline"
      className={
        ativo
          ? "border-transparent bg-primary/15 text-[10px] font-bold tracking-wide text-primary uppercase"
          : "border-transparent bg-[var(--color-surface-variant)] text-[10px] font-bold tracking-wide text-[var(--color-on-surface-variant)] uppercase"
      }
    >
      {ativo ? activeLabel : inactiveLabel}
    </Badge>
  );
}
