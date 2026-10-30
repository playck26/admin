"use client";

import { useEffect, useState } from "react";
import { Layers } from "lucide-react";
import {
  ApiError,
  definirRestricaoDeNivel,
  getMinhaEmpresa,
} from "@/lib/api-client";

/**
 * SPEC-093/D6 — a confirmação de quem LIGA. Ligar não tira ninguém de turma
 * (SPEC-089/D2), e o gestor precisa ler isso antes: senão espera que o
 * sistema tire os alunos fora do nível e depois descobre que não tirou.
 */
export const CONFIRMACAO_AO_LIGAR =
  "Alunos fora do nível continuam nas turmas atuais, mas não entram em turmas novas de outro nível.";

/**
 * SPEC-093/D2 — o interruptor da restrição de nível, na tela de Níveis.
 *
 * Até aqui a chave da SPEC-089 só mudava por SQL em produção. O valor vem de
 * `GET /me/company` e volta pelo `PATCH` do mesmo lugar; o clube sai do
 * token, e a tela nunca manda id.
 */
export function RestricaoDeNivelCard() {
  const [restringe, setRestringe] = useState<boolean | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    getMinhaEmpresa()
      .then((empresa) => setRestringe(empresa.nivelRestringeAcesso))
      .catch((e: unknown) =>
        setErro(
          e instanceof ApiError ? e.message : "Não foi possível carregar.",
        ),
      );
  }, []);

  if (restringe === null) {
    return erro ? (
      <p role="alert" className="text-sm text-[var(--color-error)]">
        {erro}
      </p>
    ) : null;
  }

  async function alternar() {
    const novo = !restringe;
    // D6 — só ligar pede confirmação; desligar troca direto.
    if (novo && !window.confirm(`Ligar a restrição de nível?\n\n${CONFIRMACAO_AO_LIGAR}`)) {
      return;
    }
    setErro(null);
    setSalvando(true);
    try {
      setRestringe((await definirRestricaoDeNivel(novo)).nivelRestringeAcesso);
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : "Não foi possível salvar.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="max-w-2xl rounded-xl border border-[var(--color-outline)] bg-[var(--color-surface)] p-6">
      <div className="flex items-center gap-2">
        <Layers className="size-5 text-[var(--color-primary)]" />
        <h2 className="text-lg font-semibold">Restrição de nível</h2>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">
            {restringe ? "Ligada" : "Desligada"}
          </p>
          <p className="mt-0.5 text-sm text-[var(--color-on-surface-variant)]">
            {restringe
              ? "Cada aluno só entra nas turmas do seu nível."
              : "O nível é só um rótulo: qualquer aluno entra em qualquer turma."}
          </p>
        </div>
        <button
          type="button"
          disabled={salvando}
          onClick={() => void alternar()}
          className="inline-flex h-10 shrink-0 items-center rounded-lg border border-[var(--color-outline)] px-4 text-sm font-semibold disabled:opacity-60"
        >
          {salvando ? "Salvando..." : restringe ? "Desligar" : "Ligar"}
        </button>
      </div>
      {erro ? (
        <p role="alert" className="mt-3 text-sm text-[var(--color-error)]">
          {erro}
        </p>
      ) : null}
    </div>
  );
}
