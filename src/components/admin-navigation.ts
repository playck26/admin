import {
  Armchair,
  BarChart3,
  CalendarDays,
  LayoutDashboard,
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
  { href: "/turmas", label: "Turmas", icon: Armchair },
  { href: "/pagamentos", label: "Pagamentos", icon: Wallet },
] as const;

export function adminItemIsActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
