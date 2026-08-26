import {
  Armchair,
  BarChart3,
  CalendarDays,
  LayoutDashboard,
  Tags,
  Users,
  Wallet,
} from "lucide-react";
import { TennisCourtIcon } from "@/components/icons/tennis-court-icon";
import { TennisBallIcon } from "@/components/icons/tennis-ball-icon";

export const ADMIN_NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/agenda", label: "Agenda", icon: CalendarDays },
  { href: "/pessoas/alunos", label: "Alunos", icon: Users },
  { href: "/pessoas/professores", label: "Professores", icon: TennisBallIcon },
  { href: "/pessoas/niveis", label: "Níveis", icon: BarChart3 },
  { href: "/quadras", label: "Quadras", icon: TennisCourtIcon },
  // SPEC-020 — logo abaixo de Quadras: e de la que se chega, e quem vem
  // cadastrar uma quadra e nao acha o esporte precisa do caminho curto.
  { href: "/quadras/catalogos", label: "Esportes e pisos", icon: Tags },
  { href: "/turmas", label: "Turmas", icon: Armchair },
  { href: "/pagamentos", label: "Pagamentos", icon: Wallet },
] as const;

/**
 * Qual item do menu está aceso.
 *
 * **O `startsWith` sozinho não bastava** (achado em 2026-08-26, SPEC-020):
 * com `/quadras/catalogos` no menu ao lado de `/quadras`, aquela rota
 * acendia **as duas** — uma por igualdade, outra por prefixo. Menu com dois
 * itens ativos não é feio, é enganoso: a pessoa não sabe onde está.
 *
 * A regra passou a ser **o item mais específico ganha**. O prefixo continua
 * valendo — `/quadras/[id]` precisa acender "Quadras" —, mas só quando
 * nenhum item mais longo casa com a rota.
 *
 * A comparação de prefixo usa a barra (`${href}/`) de propósito:
 * `/quadrasx` não é sub-rota de `/quadras`.
 */
export function adminItemIsActive(pathname: string, href: string): boolean {
  const casa = (alvo: string) =>
    pathname === alvo || pathname.startsWith(`${alvo}/`);

  if (!casa(href)) return false;

  // Existe item MAIS longo que também casa? Então o aceso é o outro.
  return !ADMIN_NAV_ITEMS.some(
    (outro) => outro.href.length > href.length && casa(outro.href),
  );
}
