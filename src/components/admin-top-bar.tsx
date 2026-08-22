"use client";

import Link from "next/link";
import { Bell, Settings } from "lucide-react";

// Sino continua inerte (SPEC-008): não há backend de notificação.
// A engrenagem **deixou de ser inerte** em SPEC-010 — passou a existir uma
// tela de configurações (horário de funcionamento), e um botão que não faz
// nada quando já existe destino é pior do que não ter o botão.
export function AdminTopBar() {
  return (
    <header className="sticky top-0 z-10 flex items-center justify-end gap-2 bg-background px-4 py-4 md:px-8">
      <button
        type="button"
        aria-label="Notificações"
        className="rounded-full p-2 text-[var(--color-on-surface-variant)] transition-colors hover:bg-accent hover:text-primary"
      >
        <Bell className="size-5" />
      </button>
      <Link
        href="/configuracoes"
        aria-label="Configurações"
        className="rounded-full p-2 text-[var(--color-on-surface-variant)] transition-colors hover:bg-accent hover:text-primary"
      >
        <Settings className="size-5" />
      </Link>
    </header>
  );
}
