import {
  Armchair,
  BarChart3,
  CalendarDays,
  LayoutDashboard,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { TennisCourtIcon } from "@/components/icons/tennis-court-icon";
import { TennisBallIcon } from "@/components/icons/tennis-ball-icon";

type ItemDeNavegacao = {
  href: string;
  label: string;
  icon: LucideIcon | typeof TennisCourtIcon;
  /**
   * SPEC-053/D6 — rotas que também acendem o item, além do `href` e seus
   * subcaminhos. Existe para "Reservas" acender nas páginas de quadra, que não
   * mudaram de endereço (categoria C da SPEC-053).
   */
  tambemEm?: readonly string[];
};

export const ADMIN_NAV_ITEMS: readonly ItemDeNavegacao[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/agenda", label: "Agenda", icon: CalendarDays },
  { href: "/pessoas/alunos", label: "Alunos", icon: Users },
  { href: "/pessoas/professores", label: "Professores", icon: TennisBallIcon },
  { href: "/pessoas/niveis", label: "Níveis", icon: BarChart3 },
  // SPEC-053/D6 — "Quadras" e "Esportes e pisos" viraram UM item. A página
  // `/reservas` agrupa os dois como cartões; as rotas de quadra continuam.
  {
    href: "/reservas",
    label: "Reservas",
    icon: TennisCourtIcon,
    tambemEm: ["/quadras"],
  },
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
 *
 * **SPEC-053/D6:** um item pode acender também em outras rotas (`tambemEm`).
 * A especificidade passou a ser o **prefixo mais longo que casa**, entre o
 * `href` e os `tambemEm` de cada item — e continua valendo que só um acende.
 */
export function adminItemIsActive(pathname: string, href: string): boolean {
  const casa = (alvo: string) =>
    pathname === alvo || pathname.startsWith(`${alvo}/`);

  /** Comprimento do prefixo mais longo do item que casa com a rota; `-1` se nenhum. */
  const melhorCasamento = (item: Pick<ItemDeNavegacao, "href" | "tambemEm">) =>
    Math.max(
      -1,
      ...[item.href, ...(item.tambemEm ?? [])]
        .filter(casa)
        .map((alvo) => alvo.length),
    );

  const item = ADMIN_NAV_ITEMS.find((i) => i.href === href) ?? { href };
  const meu = melhorCasamento(item);
  if (meu < 0) return false;

  // Existe item cujo casamento é MAIS longo? Então o aceso é o outro.
  return !ADMIN_NAV_ITEMS.some(
    (outro) => outro.href !== href && melhorCasamento(outro) > meu,
  );
}
