"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users, BarChart3, LayoutGrid, Armchair, Wallet } from "lucide-react";
import { TennisBallIcon } from "@/components/icons/tennis-ball-icon";
import { getAdminUser, type StoredAdminUser } from "@/lib/auth-storage";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/pessoas/alunos", label: "Alunos", icon: Users },
  { href: "/pessoas/professores", label: "Professores", icon: TennisBallIcon },
  { href: "/pessoas/niveis", label: "Níveis", icon: BarChart3 },
  { href: "/quadras", label: "Quadras", icon: LayoutGrid },
  { href: "/turmas", label: "Turmas", icon: Armchair },
  { href: "/pagamentos", label: "Pagamentos", icon: Wallet },
];

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminSidebar() {
  const pathname = usePathname();
  const [user, setUser] = useState<StoredAdminUser | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUser(getAdminUser());
  }, []);

  const initial = user?.nome.trim().charAt(0).toUpperCase() || "A";

  return (
    <aside className="fixed top-0 left-0 z-20 hidden h-screen w-[250px] flex-col border-r border-border bg-[var(--color-surface-container-low)] py-6 md:flex">
      <div className="mb-8 px-6">
        <h1 className="text-[28px] leading-[34px] font-bold tracking-[-0.02em] text-primary">PlayCK</h1>
        <p className="mt-1 text-xs font-medium text-[var(--color-on-surface-variant)]">Admin Management</p>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const active = isActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 border-l-4 py-3 pr-6 pl-5 text-[13px] font-medium transition-colors ${
                active
                  ? "border-primary bg-accent font-semibold text-primary"
                  : "border-transparent text-[var(--color-on-surface-variant)] hover:bg-accent hover:text-primary"
              }`}
            >
              <Icon className="size-5 shrink-0" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto px-4">
        <div className="flex items-center gap-3 rounded-lg border border-border bg-[var(--color-surface-container)] p-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary-container)] text-sm font-bold text-[var(--color-on-primary-container)]">
            {initial}
          </div>
          <div className="min-w-0">
            <p className="truncate text-[13px] font-semibold text-foreground">{user?.nome ?? "Admin"}</p>
            <p className="truncate text-xs text-[var(--color-on-surface-variant)]">{user?.email ?? ""}</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
