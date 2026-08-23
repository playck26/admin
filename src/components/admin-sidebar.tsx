"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ADMIN_NAV_ITEMS, adminItemIsActive } from "@/components/admin-navigation";
import { getAdminUser, type StoredAdminUser } from "@/lib/auth-storage";

export function AdminSidebar() {
  const pathname = usePathname();
  const [user, setUser] = useState<StoredAdminUser | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUser(getAdminUser());
  }, []);

  const initial = user?.nome.trim().charAt(0).toUpperCase() || "A";

  return (
    <aside className="fixed top-0 left-0 z-20 hidden h-screen w-[260px] flex-col bg-[var(--color-court-dark)] py-5 text-white md:flex">
      <div className="mb-6 flex items-center gap-3 px-5">
        <div className="flex size-12 items-center justify-center rounded-lg bg-white shadow-lg">
          <Image src="/playck-logo.png" alt="PlayCK" width={42} height={42} className="size-10 object-contain" priority />
        </div>
        <div>
          <h1 className="text-xl leading-none font-extrabold">PlayCK</h1>
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
