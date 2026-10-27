import type { ReactNode } from "react";
import Image from "next/image";

/**
 * SPEC-090 (D9) — **a composição das duas páginas novas do "esqueci minha
 * senha"**, no visual do login do Admin.
 *
 * O Admin não tem `AuthShell` (o Cliente tem). O login monta o fundo em
 * `app/login/page.tsx` e o cartão dentro do próprio `LoginForm`; as duas
 * páginas da redefinição precisam do mesmo fundo e do mesmo cartão, com
 * outro título. Em vez de copiar as duas metades em cada página, elas moram
 * aqui. **O login não foi migrado para cá**: a página dele está fora do
 * escopo da SPEC-090, e a cópia do visual é o que este componente segura.
 *
 * Componente de servidor (sem `"use client"`): só desenha. O formulário de
 * cada página entra como `children`.
 */
export function TelaDeAcesso({
  titulo,
  descricao,
  children,
}: {
  titulo: string;
  descricao: string;
  children: ReactNode;
}) {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[var(--color-court-dark)] p-4">
      <span aria-hidden="true" className="court-lines pointer-events-none absolute inset-0 opacity-20" />
      <div className="absolute inset-x-0 bottom-0 h-1 bg-[var(--color-secondary)]" />
      <div className="relative z-10 min-w-0 w-full max-w-[430px]">
        <div className="min-w-0 w-full overflow-hidden rounded-[var(--radius-hero)] bg-[var(--color-surface-container-lowest)] p-7 shadow-[var(--shadow-lift)] sm:p-8">
          <div className="mb-6 flex flex-col items-center text-center">
            <div className="mb-5 flex size-20 items-center justify-center rounded-xl bg-white shadow-[var(--shadow-low)] ring-1 ring-border">
              <Image src="/playck-logo.png" alt="PlayCK" width={72} height={72} className="size-[70px] object-contain" priority />
            </div>
            <p className="text-xs font-bold tracking-[0.15em] text-[var(--color-primary-strong)] uppercase">Gestão da arena</p>
            <h1 className="mt-2 text-[28px] leading-tight font-extrabold text-[var(--color-on-surface)]">{titulo}</h1>
            <p className="mt-2 text-sm text-[var(--color-on-surface-variant)]">{descricao}</p>
          </div>
          {children}
        </div>
      </div>
    </main>
  );
}
