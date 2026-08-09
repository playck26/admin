"use client";

import { Bell, Settings } from "lucide-react";

// Sino/engrenagem inertes (SPEC-008, decisão do usuário): sem backend de
// notificação ou tela de configurações hoje — visíveis, sem badge, sem ação.
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
      <button
        type="button"
        aria-label="Configurações"
        className="rounded-full p-2 text-[var(--color-on-surface-variant)] transition-colors hover:bg-accent hover:text-primary"
      >
        <Settings className="size-5" />
      </button>
    </header>
  );
}
