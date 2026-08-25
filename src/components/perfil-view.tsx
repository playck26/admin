"use client";

import { useEffect, useState } from "react";
import { FotoDePerfil } from "@/components/foto-de-perfil";
import { getAdminUser, type StoredAdminUser } from "@/lib/auth-storage";

/**
 * SPEC-018/TASK-003 — a página que hospeda a foto de perfil do gestor.
 *
 * **Ela é deliberadamente pequena.** A spec é explícita sobre o que NÃO
 * entra: logout e dados da conta são outra demanda do Israel, sem
 * dependência de storage, e saem em spec própria. Aqui o logout já vive na
 * barra do topo, então repeti-lo seria dois lugares para a mesma ação.
 *
 * O shell (sidebar + barra) vem do layout de `(app)`; esta view é só o
 * conteúdo.
 *
 * O nome vem do `localStorage` (`getAdminUser`), como no resto do painel —
 * este repositório não tem `getMe`, e criar um só para escrever um nome no
 * cabeçalho seria uma chamada de rede por enfeite.
 */
export function PerfilView() {
  const [usuario, setUsuario] = useState<StoredAdminUser | null>(null);

  // `useEffect` e não leitura direta: `localStorage` não existe no servidor,
  // e ler no corpo do componente quebraria a renderização inicial.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUsuario(getAdminUser());
  }, []);

  return (
    <div className="mx-auto max-w-2xl py-8">
      <header className="mb-8">
        <h1 className="text-2xl font-extrabold text-[var(--color-primary-strong)]">
          Seu perfil
        </h1>
        {usuario ? (
          <p className="mt-1 text-sm text-[var(--color-on-surface-variant)]">
            {usuario.nome} · {usuario.email}
          </p>
        ) : null}
      </header>

      <FotoDePerfil nome={usuario?.nome} />
    </div>
  );
}
