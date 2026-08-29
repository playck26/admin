"use client";

import { useEffect, useState } from "react";
import { FileText } from "lucide-react";
import {
  ApiError,
  getAlcanceDoContrato,
  getContratoDaEmpresa,
  publicarContrato,
  type ContratoDaEmpresa,
} from "@/lib/api-client";

/**
 * SPEC-024/TASK-005 — **o contrato do clube, escrito pelo gestor.**
 *
 * Duas coisas nesta tela existem por decisão, não por estilo:
 *
 * **1. Publicar avisa o alcance, com o número na frente.** A decisão do
 * Israel (ADR-017, item 3) é que contrato novo obriga *todo mundo* a
 * reaceitar. Um botão "Publicar" sem esse aviso parece salvar rascunho — e
 * não é: interrompe cada aluno no próximo acesso ao app.
 *
 * **2. Não existe despublicar** (LIM-024a). Publicar errado exige publicar de
 * novo com o texto certo, e aí todo mundo reaceita duas vezes. O contrário —
 * apagar uma versão — destruiria o registro de quem aceitou o quê, que é a
 * razão da spec existir. A tela diz isso antes, não depois.
 */
export function ContratoDoClubeCard() {
  const [contrato, setContrato] = useState<ContratoDaEmpresa | null>(null);
  const [texto, setTexto] = useState("");
  const [alcance, setAlcance] = useState<number | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const [publicando, setPublicando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getContratoDaEmpresa(), getAlcanceDoContrato()])
      .then(([c, a]) => {
        setContrato(c);
        setTexto(c.texto ?? "");
        setAlcance(a.pessoas);
      })
      .catch((e: unknown) =>
        setErro(
          e instanceof ApiError ? e.message : "Não foi possível carregar.",
        ),
      );
  }, []);

  if (!contrato) {
    return null;
  }

  const mudou = texto.trim() !== (contrato.texto ?? "").trim();
  const vazio = texto.trim().length === 0;

  async function publicar() {
    setErro(null);
    setPublicando(true);
    try {
      const novo = await publicarContrato(texto);
      setContrato(novo);
      setTexto(novo.texto ?? "");
      setConfirmando(false);
    } catch (e: unknown) {
      setErro(e instanceof ApiError ? e.message : "Não foi possível publicar.");
    } finally {
      setPublicando(false);
    }
  }

  return (
    <div className="rounded-xl border border-[var(--color-outline)] bg-[var(--color-surface)] p-6">
      <div className="flex items-start gap-3">
        <FileText
          className="mt-0.5 size-5 shrink-0 text-[var(--color-on-surface-variant)]"
          aria-hidden="true"
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h2 className="text-lg font-bold">Contrato do clube</h2>
            {contrato.versao === null ? (
              <span className="rounded-full bg-[var(--color-surface-variant)] px-2.5 py-0.5 text-xs font-bold text-[var(--color-on-surface-variant)]">
                nunca publicado
              </span>
            ) : (
              <span className="rounded-full bg-[var(--color-surface-variant)] px-2.5 py-0.5 text-xs font-bold text-[var(--color-on-surface-variant)]">
                versão {contrato.versao} no ar
              </span>
            )}
          </div>

          <p className="mt-1 text-sm text-[var(--color-on-surface-variant)]">
            O texto que cada aluno aceita ao entrar no app. Enquanto você não
            publicar nenhum, o aluno só aceita o termo da plataforma.
          </p>

          <label className="sr-only" htmlFor="contrato-texto">
            Texto do contrato
          </label>
          <textarea
            id="contrato-texto"
            rows={12}
            value={texto}
            onChange={(e) => {
              setTexto(e.target.value);
              setConfirmando(false);
            }}
            placeholder="Escreva aqui o contrato do seu clube."
            className="mt-4 w-full rounded-lg border border-[var(--color-outline)] bg-[var(--color-surface)] p-3 font-mono text-[13px] leading-relaxed"
          />
          <p className="mt-1 text-xs text-[var(--color-on-surface-variant)]">
            Texto simples. Negrito e links não são interpretados — as quebras
            de linha são preservadas como você escrever.
          </p>

          {/*
            O aviso de alcance vem ANTES da confirmação, com o número. Quem
            publica precisa saber que isso interrompe gente, não que "salva".
          */}
          {confirmando ? (
            <div className="mt-4 rounded-lg border border-[var(--color-outline)] bg-[var(--color-surface-variant)] p-4">
              <p className="text-sm font-bold">
                {alcance === 0
                  ? "Nenhum aluno ativo será afetado agora."
                  : `${alcance} ${alcance === 1 ? "pessoa terá" : "pessoas terão"} que ler e aceitar este texto no próximo acesso ao app.`}
              </p>
              <p className="mt-2 text-sm text-[var(--color-on-surface-variant)]">
                Quem já aceitou a versão anterior precisa aceitar de novo. Não
                é possível despublicar: para corrigir, publique outra versão.
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  disabled={publicando}
                  onClick={() => void publicar()}
                  className="h-11 rounded-lg bg-[var(--color-primary)] px-5 text-[15px] font-bold text-[var(--color-on-primary)] disabled:opacity-60"
                >
                  {publicando
                    ? "Publicando..."
                    : `Publicar versão ${(contrato.versao ?? 0) + 1}`}
                </button>
                <button
                  type="button"
                  disabled={publicando}
                  onClick={() => setConfirmando(false)}
                  className="h-11 rounded-lg border border-[var(--color-outline)] px-5 text-[15px] font-bold"
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              disabled={!mudou || vazio}
              onClick={() => setConfirmando(true)}
              className="mt-4 h-11 rounded-lg bg-[var(--color-primary)] px-5 text-[15px] font-bold text-[var(--color-on-primary)] disabled:opacity-60"
            >
              Publicar contrato
            </button>
          )}

          {!mudou && contrato.versao !== null && !confirmando && (
            <p className="mt-2 text-sm text-[var(--color-on-surface-variant)]">
              Este é o texto que está no ar. Edite para publicar uma versão
              nova.
            </p>
          )}

          {erro && (
            <p role="alert" className="mt-3 text-sm text-[var(--color-error)]">
              {erro}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
