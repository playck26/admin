"use client";

import { useCallback, useSyncExternalStore } from "react";
import Image from "next/image";
import { Share, SquarePlus, X } from "lucide-react";
import {
  assinarInstalacao,
  consumirEvento,
  eventoDisponivel,
  lerModoDeConvite,
  limparDispensa,
  modoNoServidor,
  registrarDispensa,
} from "@/lib/instalacao-pwa";

/**
 * SPEC-050 — **o convite para instalar, que este app nunca teve.**
 *
 * A ADR-012 decidiu que `cliente` **e `admin` (e `sadmin`)** seriam PWA
 * instalável. Só o `cliente` foi: até esta spec, `admin.playck.com.br` não
 * tinha manifest (404), não tinha service worker e não tinha ícone de
 * instalação. Não era uma decisão revista — era a ADR não cumprida em dois
 * dos três frontends, e ninguém tinha conferido.
 *
 * Por que importa num painel: **o gestor não opera sentado.** Ele confere a
 * agenda e a chamada com o celular na mão, na beira da quadra, e reabrir o
 * navegador e achar a aba é atrito em cima de atrito. App instalado abre da
 * tela de início, em tela cheia, sem barra de endereço comendo altura.
 *
 * ## Dois modos, porque são dois mundos
 *
 * - **`botao`** (Chromium: Android, Chrome/Edge desktop) — existe um evento
 *   `beforeinstallprompt` guardado, e `prompt()` abre o diálogo **nativo**.
 * - **`instrucao`** (iOS) — `beforeinstallprompt` não existe no Safari e não
 *   vai existir. Não há diálogo a abrir: o único caminho é Compartilhar →
 *   "Adicionar à Tela de Início", e a única coisa útil que o app pode fazer é
 *   ensinar o caminho. Sem este modo, todo gestor de iPhone fica sem
 *   instalação.
 *
 * ## Sem `useEffect`, e o porquê importa
 *
 * Instalação é **sistema externo**: dois eventos de `window` e uma chave de
 * `localStorage`. Ler sistema externo com `useEffect` + `setState` é o que o
 * `react-hooks/set-state-in-effect` recusa — e a primeira versão deste
 * componente levou exatamente esse erro no `eslint` dos três repositórios.
 * `useSyncExternalStore` é a ferramenta certa, e a decisão toda vive em
 * `lib/instalacao-pwa.ts`.
 *
 * ## A posição
 *
 * `bottom-2` encostado no rodapé, e à **direita** a partir de `sm`: este app
 * navega por sidebar e top bar (`admin-sidebar.tsx`, `admin-top-bar.tsx`) e
 * não tem nada fixo embaixo com o que colidir. Centralizar um card de 390px
 * no rodapé de uma tela de desktop pareceria erro de layout; canto inferior
 * direito é onde se espera um aviso que não bloqueia.
 *
 * É a única diferença real desta cópia em relação à do `cliente`, que precisa
 * de `bottom-[94px]` para não cobrir a `BottomNav` dela. Três cópias (com o
 * `sadmin`) e não um pacote compartilhado, por ADR-001 (poly-repo, sem pacote
 * comum) — a mesma razão pela qual os tokens de `DESIGN.md` são copiados
 * localmente.
 */
export function ConviteDeInstalacao() {
  const modo = useSyncExternalStore(
    assinarInstalacao,
    lerModoDeConvite,
    modoNoServidor,
  );

  const dispensar = useCallback(() => registrarDispensa(), []);

  /**
   * Um "não" no diálogo nativo conta como dispensa: perguntar de novo na
   * próxima tela seria pior que não ter convite nenhum. **Aceitar não conta** —
   * se a instalação falhar depois, a pessoa ficaria 15 dias sem convite por
   * ter dito "sim".
   */
  const instalar = useCallback(async () => {
    const evento = eventoDisponivel();
    if (!evento) return;
    try {
      await evento.prompt();
      const { outcome } = await evento.userChoice;
      if (outcome === "dismissed") registrarDispensa();
      else limparDispensa();
    } catch {
      // Diálogo recusado pelo navegador (evento já consumido, gesto perdido).
      // Não registra dispensa: não foi decisão da pessoa, então o convite volta
      // na próxima visita, quando um evento novo puder chegar.
    } finally {
      consumirEvento();
    }
  }, []);

  if (modo === "oculto") return null;

  return (
    <div
      role="region"
      aria-label="Instalar o PlayCK Admin"
      className="fixed inset-x-2 bottom-2 z-40 flex items-center gap-3 rounded-[28px] bg-surface p-3 shadow-[0_18px_48px_rgba(18,20,15,0.28)] ring-1 ring-border sm:left-auto sm:right-4 sm:w-[390px]"
    >
      <Image
        src="/icon-192.png"
        alt=""
        width={44}
        height={44}
        className="size-11 shrink-0 rounded-[14px] object-contain"
      />

      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-bold text-[var(--color-text-primary)]">
          Instale o PlayCK Admin
        </p>
        {modo === "botao" ? (
          <p className="text-[12px] font-medium text-[var(--color-text-secondary)]">
            Abre direto da tela de início, sem navegador.
          </p>
        ) : (
          <p className="flex flex-wrap items-center gap-x-1 gap-y-0.5 text-[12px] font-medium text-[var(--color-text-secondary)]">
            <span>Toque em</span>
            <Share className="size-[14px] shrink-0" aria-hidden="true" />
            <span className="font-bold">Compartilhar</span>
            <span>e depois em</span>
            <SquarePlus className="size-[14px] shrink-0" aria-hidden="true" />
            <span className="font-bold">Adicionar à Tela de Início</span>
          </p>
        )}
      </div>

      {modo === "botao" && (
        <button
          type="button"
          onClick={() => void instalar()}
          className="min-h-11 shrink-0 rounded-full bg-[var(--color-primary-strong)] px-4 text-[13px] font-bold text-white"
        >
          Instalar
        </button>
      )}

      {/*
        Alvo de 44px mesmo com ícone de 16px — um "x" pequeno num banner é o
        jeito clássico de tornar a dispensa impossível.
      */}
      <button
        type="button"
        onClick={dispensar}
        aria-label="Agora não"
        className="flex size-11 shrink-0 items-center justify-center rounded-full text-[var(--color-text-secondary)]"
      >
        <X className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}
