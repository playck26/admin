"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, PackagePlus } from "lucide-react";
import { TennisCourtIcon } from "@/components/icons/tennis-court-icon";
import { NomesDeTipoCard } from "@/components/nomes-de-tipo-card";
import { listCourts } from "@/lib/api-client";

/**
 * SPEC-053/D6 — **Reservas, no painel: uma página que agrupa.**
 *
 * "Quadras" e "Esportes e pisos" eram itens soltos do menu. Para o usuário,
 * Reservas passa a ser a área, e quadra, um tipo de reserva (ADR-021). As rotas
 * de quadra **não mudam** — nomeiam o recurso físico (categoria C da D1) —, e
 * os cartões levam a elas. A SPEC-054 acrescenta aqui Adicionais e Tipos de
 * adicional (catálogo livre do clube, D12) e o cartão dos nomes que o aluno lê
 * para os dois tipos fixos (D1).
 *
 * *Consequência aceita e declarada na spec:* quem ia direto a "Quadras" dá um
 * clique a mais.
 *
 * **SPEC-061/TASK-001 (card 5360) — os quatro cartões viraram dois grupos.**
 * O Israel abriu a página e pediu: *"gostaria que agrupasse os itens adicional
 * e tipo adicionais, assim como quadras com esportes e pisos… para que fique
 * mais fluida a navegação"*.
 *
 * Quatro cartões iguais em fileira não dizem que **Esportes e pisos** é
 * configuração de Quadras, nem que **Tipos** é como os Adicionais se agrupam —
 * a relação existia só na cabeça de quem já sabia. O título de grupo é o que
 * conta isso sem obrigar a ler as quatro descrições.
 *
 * **Nada muda de endereço, nome ou permissão:** é agrupamento visual, que foi
 * exatamente o que o card pediu.
 *
 * **SPEC-080 (o mesmo card, reaberto em 2026-09-29) — dois itens, e as abas
 * dentro.** Os títulos de grupo não bastaram: o Israel abriu a produção, viu
 * os quatro cartões de sempre e pediu *"apenas 2 itens na primeira página, e
 * na segunda vai estar os dois agrupados, um em cada aba"*. Agora são dois
 * cartões; Esportes e pisos e Tipos de adicional viraram a segunda aba da
 * página de cada um (`abas-do-grupo.tsx`). O texto de cada cartão nomeia as
 * duas abas, para a segunda não ficar escondida. O "Nomes para o cliente"
 * continua embaixo (decisão I2).
 */

/** O `back` pagina até 100. Um clube tem poucas quadras; acima disso, a contagem é do total. */
const PAGINA = 100;

export function ReservasHub() {
  const [resumoDasQuadras, setResumoDasQuadras] = useState<string | null>(null);

  useEffect(() => {
    let atual = true;
    listCourts(1, PAGINA)
      .then((r) => {
        if (!atual) return;
        const ativas = r.data.filter((q) => q.status === "ativa").length;
        setResumoDasQuadras(
          r.total > r.data.length
            ? `${r.total} quadras`
            : `${ativas} ${ativas === 1 ? "ativa" : "ativas"}`,
        );
      })
      // A contagem é informação de canto: sem ela, os cartões — que são o
      // caminho que a pessoa veio buscar — continuam na tela.
      .catch(() => undefined);
    return () => {
      atual = false;
    };
  }, []);

  const cartoes = [
    {
      href: "/quadras",
      titulo: "Quadras",
      texto: "Cadastro, preço, horário e foto de cada quadra, e os esportes e pisos.",
      Icon: TennisCourtIcon,
      detalhe: resumoDasQuadras,
    },
    {
      href: "/reservas/adicionais",
      titulo: "Adicionais",
      texto: "O que o aluno aluga junto com a reserva, e os tipos que os organizam.",
      Icon: PackagePlus,
      detalhe: null,
    },
  ];

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <div>
        <h1 className="text-3xl font-extrabold">Reservas</h1>
        <p className="mt-1 text-sm text-[var(--color-on-surface-variant)]">
          O que o clube oferece para reservar, e como cada coisa se configura.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {cartoes.map(({ href, titulo, texto, Icon, detalhe }) => (
          <Link
            key={href}
            href={href}
            className="flex items-start gap-4 rounded-lg bg-white p-5 shadow-[var(--shadow-low)] ring-1 ring-border transition-all hover:-translate-y-0.5 hover:ring-[var(--color-primary)]"
          >
            <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-[var(--color-primary-container)] text-[var(--color-primary-strong)]">
              <Icon className="size-5" aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center justify-between gap-2">
                <span className="text-lg font-extrabold">{titulo}</span>
                <ArrowUpRight
                  className="size-4 shrink-0 text-[var(--color-primary-strong)]"
                  aria-hidden="true"
                />
              </span>
              <span className="mt-1 block text-sm text-[var(--color-on-surface-variant)]">
                {texto}
              </span>
              {detalhe ? (
                <span className="mt-2 block text-xs font-bold text-[var(--color-primary-strong)]">
                  {detalhe}
                </span>
              ) : null}
            </span>
          </Link>
            ))}
      </div>

      <NomesDeTipoCard />
    </div>
  );
}
