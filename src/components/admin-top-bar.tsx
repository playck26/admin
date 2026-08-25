"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bell, LogOut, Settings } from "lucide-react";
import { ADMIN_NAV_ITEMS, adminItemIsActive } from "@/components/admin-navigation";
import { clearAccessToken } from "@/lib/auth-storage";

// Sino continua inerte (SPEC-008): não há backend de notificação.
// A engrenagem **deixou de ser inerte** em SPEC-010 — passou a existir uma
// tela de configurações (horário de funcionamento), e um botão que não faz
// nada quando já existe destino é pior do que não ter o botão.
export function AdminTopBar() {
  const pathname = usePathname();
  const router = useRouter();
  const current = ADMIN_NAV_ITEMS.find((item) => adminItemIsActive(pathname, item.href));

  function logout() {
    clearAccessToken();
    router.push("/login");
  }

  return (
    <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur">
      <div className="flex h-16 items-center gap-3 px-4 md:px-8">
        <Link href="/dashboard" className="mr-auto flex items-center gap-2 md:hidden">
          <span className="flex size-9 items-center justify-center rounded-lg bg-white shadow-sm ring-1 ring-border">
            <Image src="/playck-logo.png" alt="PlayCK" width={32} height={32} className="size-8 object-contain" />
          </span>
          <span className="font-extrabold text-[var(--color-primary-strong)]">PlayCK</span>
        </Link>
        <div className="mr-auto hidden md:block">
          <p className="text-[10px] font-bold tracking-[0.14em] text-[var(--color-on-surface-variant)] uppercase">Painel administrativo</p>
          <p className="text-sm font-extrabold">{current?.label ?? "Gestão"}</p>
        </div>
      <button
        type="button"
        aria-label="Notificações"
        className="flex size-10 items-center justify-center rounded-lg text-[var(--color-on-surface-variant)] transition-colors hover:bg-accent hover:text-primary"
      >
        <Bell className="size-5" />
      </button>
      <Link
        href="/configuracoes"
        aria-label="Configurações"
        className="flex size-10 items-center justify-center rounded-lg text-[var(--color-on-surface-variant)] transition-colors hover:bg-accent hover:text-primary"
      >
        <Settings className="size-5" />
      </Link>
        <button type="button" aria-label="Sair" onClick={logout} className="flex size-10 items-center justify-center rounded-lg text-[var(--color-on-surface-variant)] transition-colors hover:bg-[var(--color-error-container)] hover:text-[var(--color-error)]">
          <LogOut className="size-5" />
        </button>
      </div>
      <nav className="no-scrollbar flex gap-1 overflow-x-auto px-3 pb-2 md:hidden">
        {ADMIN_NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = adminItemIsActive(pathname, item.href);
          return <Link key={item.href} href={item.href} className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold ${active ? "bg-[var(--color-primary-strong)] text-white" : "bg-white text-[var(--color-on-surface-variant)] ring-1 ring-border"}`}><Icon className="size-3.5" />{item.label}</Link>;
        })}
      </nav>
    </header>
  );
}
