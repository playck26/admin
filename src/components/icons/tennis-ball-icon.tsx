import type { SVGProps } from "react";

// lucide-react não tem ícone de tênis (SPEC-008, TASK-002) — desenhado no
// mesmo estilo stroke-based do resto do set (round cap/join, strokeWidth 2,
// viewBox 24x24) pra se misturar com os ícones lucide ao redor sem destoar.
// Recriado localmente (não importado de apps/Cliente — ADR-001, poly-repo
// sem pacote compartilhado).
export function TennisBallIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M4.2 7.5c2 1.6 3.2 4 3.2 4.5s-1.2 2.9-3.2 4.5" />
      <path d="M19.8 7.5c-2 1.6-3.2 4-3.2 4.5s1.2 2.9 3.2 4.5" />
    </svg>
  );
}
