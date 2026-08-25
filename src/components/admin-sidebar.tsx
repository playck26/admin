"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ADMIN_NAV_ITEMS, adminItemIsActive } from "@/components/admin-navigation";
import { getAdminUser, type StoredAdminUser } from "@/lib/auth-storage";
import { LogoDaEmpresa } from "@/components/logo-da-empresa";
import {
  EVENTO_LOGO_TROCADA,
  getMinhaEmpresa,
  type LogoResolvida,
  type MinhaEmpresa,
} from "@/lib/api-client";

export function AdminSidebar() {
  const pathname = usePathname();
  const [user, setUser] = useState<StoredAdminUser | null>(null);
  const [empresa, setEmpresa] = useState<MinhaEmpresa | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUser(getAdminUser());
  }, []);

  // SPEC-018/TASK-006 — a marca da arena no lugar da do fornecedor.
  useEffect(() => {
    let vivo = true;
    getMinhaEmpresa()
      .then((e) => {
        if (vivo) setEmpresa(e);
      })
      .catch(() => {
        // Sem logo o painel continua inteiro. Nada do que o gestor veio
        // fazer depende disto.
      });
    return () => {
      vivo = false;
    };
  }, []);

  // O gestor troca a logo em Configurações, que não é pai desta sidebar.
  // Sem este ouvinte, ele veria a nova no cartão e a antiga aqui no canto
  // até recarregar a página — e isso parece defeito, não cache.
  useEffect(() => {
    function aoTrocar(evento: Event) {
      const { logoUrl } = (evento as CustomEvent<LogoResolvida>).detail;
      setEmpresa((atual) => (atual ? { ...atual, logoUrl } : atual));
    }
    window.addEventListener(EVENTO_LOGO_TROCADA, aoTrocar);
    return () => window.removeEventListener(EVENTO_LOGO_TROCADA, aoTrocar);
  }, []);

  const initial = user?.nome.trim().charAt(0).toUpperCase() || "A";

  return (
    <aside className="fixed top-0 left-0 z-20 hidden h-screen w-[260px] flex-col bg-[var(--color-court-dark)] py-5 text-white md:flex">
      <div className="mb-6 flex items-center gap-3 px-5">
        <div className="flex size-12 items-center justify-center rounded-lg bg-white shadow-lg">
          <LogoDaEmpresa url={empresa?.logoUrl ?? null} nome={empresa?.nome} className="size-10" />
        </div>
        <div>
          {/* Enquanto a empresa não chega, "PlayCK" segura o espaço: trocar
              por vazio faria o cabeçalho pular a cada carregamento. */}
          <h1 className="text-xl leading-none font-extrabold">{empresa?.nome ?? "PlayCK"}</h1>
          <p className="mt-1 text-[10px] font-bold tracking-[0.14em] text-white/50 uppercase">Gestão da arena</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3">
        {ADMIN_NAV_ITEMS.map((item) => {
          const active = adminItemIsActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-3 text-[13px] font-semibold transition-colors ${
                active
                  ? "bg-[var(--color-secondary)] text-[var(--color-court-dark)] shadow-lg"
                  : "text-white/62 hover:bg-white/8 hover:text-white"
              }`}
            >
              <Icon className="size-5 shrink-0" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto px-3">
        <div className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/6 p-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary)] text-sm font-bold text-white">
            {initial}
          </div>
          <div className="min-w-0">
            <p className="truncate text-[13px] font-semibold text-white">{user?.nome ?? "Admin"}</p>
            <p className="truncate text-xs text-white/45">{user?.email ?? ""}</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
