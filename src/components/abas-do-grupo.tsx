"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * SPEC-080 (card 5360) — **as abas de um grupo da página Reservas.**
 *
 * O Israel pediu três níveis: Reservas mostra dois itens; cada item abre uma
 * página com duas abas; e só dentro da aba se chega à página final. A SPEC-061
 * tinha só dado títulos de grupo aos quatro cartões, e quem estava em Quadras
 * não via que Esportes e pisos existia sem voltar a Reservas.
 *
 * **Cada aba é um link para a rota que já existia** (D1), e a ativa sai do
 * endereço. Assim nenhum endereço muda: link salvo, botão voltar e o
 * "cadastre em Esportes e pisos" do `seletor-de-catalogo` continuam valendo, e
 * cada um abre na aba certa. Por isso é navegação (`<nav>` + `aria-current`),
 * e não `role="tablist"`: a aba troca de página, não de painel — mesmo visual
 * das abas da turma (`turma-chamada-abas`).
 */
export const GRUPOS = {
  quadras: {
    rotulo: "Quadras",
    abas: [
      { href: "/quadras", rotulo: "Quadras" },
      { href: "/quadras/catalogos", rotulo: "Esportes e pisos" },
    ],
  },
  adicionais: {
    rotulo: "Adicionais",
    abas: [
      { href: "/reservas/adicionais", rotulo: "Adicionais" },
      { href: "/reservas/tipos", rotulo: "Tipos de adicional" },
    ],
  },
} as const;

export type GrupoDeReserva = keyof typeof GRUPOS;

export function AbasDoGrupo({ grupo }: { grupo: GrupoDeReserva }) {
  const pathname = usePathname();
  const { rotulo, abas } = GRUPOS[grupo];

  return (
    <nav aria-label={rotulo} className="flex gap-1 border-b border-border">
      {abas.map((aba) => {
        // Igualdade exata, e não prefixo: `/quadras` é prefixo de
        // `/quadras/catalogos`, e as duas abas acenderiam juntas.
        const ativa = pathname === aba.href;
        return (
          <Link
            key={aba.href}
            href={aba.href}
            aria-current={ativa ? "page" : undefined}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              ativa
                ? "border-primary text-primary"
                : "border-transparent text-[var(--color-on-surface-variant)] hover:text-[var(--color-on-surface)]"
            }`}
          >
            {aba.rotulo}
          </Link>
        );
      })}
    </nav>
  );
}
