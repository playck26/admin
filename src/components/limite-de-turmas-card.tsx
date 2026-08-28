"use client";

import { useEffect, useState } from "react";
import { Users } from "lucide-react";
import {
  ApiError,
  definirLimiteDeTurmas,
  getMinhaEmpresa,
  type MinhaEmpresa,
} from "@/lib/api-client";

/**
 * SPEC-023 — **quantas turmas um aluno pode entrar por conta própria.**
 *
 * A spec deu ao aluno o direito de entrar e sair de turma sozinho. Este
 * cartão é o contrapeso: o clube decide até onde vai esse "sozinho".
 *
 * **Vazio significa sem limite, e é o padrão** — empresa que já existe não
 * mudou de comportamento quando a coluna nasceu. Um número padrão qualquer
 * seria uma regra inventada por nós entrando em vigor sem ninguém pedir.
 *
 * **O limite vale para entrar, nunca para expulsar** (INV-023a). Baixar de 3
 * para 1 não tira ninguém das turmas em que já está; só impede a próxima
 * entrada. Isso está escrito na tela, não só aqui: quem configura precisa
 * saber o que vai — e o que não vai — acontecer.
 */
export function LimiteDeTurmasCard() {
  const [empresa, setEmpresa] = useState<MinhaEmpresa | null>(null);
  const [valor, setValor] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);

  useEffect(() => {
    getMinhaEmpresa()
      .then((e) => {
        setEmpresa(e);
        setValor(
          e.limiteTurmasPorAluno === null ? "" : String(e.limiteTurmasPorAluno),
        );
      })
      .catch((e: unknown) =>
        setErro(
          e instanceof ApiError ? e.message : "Não foi possível carregar.",
        ),
      );
  }, []);

  if (!empresa) {
    return null;
  }

  async function salvar() {
    setErro(null);
    setSalvo(false);

    const limpo = valor.trim();
    // Campo vazio é "sem limite", não erro: é o estado padrão e precisa ser
    // alcançável de volta depois de alguém ter posto um número.
    const limite = limpo === "" ? null : Number(limpo);

    if (limite !== null && (!Number.isInteger(limite) || limite < 1)) {
      setErro(
        'O limite começa em 1. Para não limitar, deixe o campo vazio — zero seria "ninguém entra", que é desativar a turma, não limitar.',
      );
      return;
    }

    setSalvando(true);
    try {
      setEmpresa(await definirLimiteDeTurmas(limite));
      setSalvo(true);
    } catch (e: unknown) {
      setErro(
        e instanceof ApiError ? e.message : "Não foi possível salvar.",
      );
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="rounded-xl border border-[var(--color-outline)] bg-[var(--color-surface)] p-6">
      <div className="flex items-start gap-3">
        <Users
          className="mt-0.5 size-5 shrink-0 text-[var(--color-on-surface-variant)]"
          aria-hidden="true"
        />
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-bold">Limite de turmas por aluno</h2>
          <p className="mt-1 text-sm text-[var(--color-on-surface-variant)]">
            Quantas turmas cada aluno pode entrar sozinho pelo app. Deixe
            vazio para não limitar.
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <label className="sr-only" htmlFor="limite-turmas">
              Limite de turmas por aluno
            </label>
            <input
              id="limite-turmas"
              type="number"
              min={1}
              step={1}
              inputMode="numeric"
              placeholder="Sem limite"
              value={valor}
              onChange={(e) => {
                setValor(e.target.value);
                setSalvo(false);
              }}
              className="h-11 w-40 rounded-lg border border-[var(--color-outline)] bg-[var(--color-surface)] px-3 text-[15px]"
            />
            <button
              type="button"
              disabled={salvando}
              onClick={() => void salvar()}
              className="h-11 rounded-lg bg-[var(--color-primary)] px-5 text-[15px] font-bold text-[var(--color-on-primary)] disabled:opacity-60"
            >
              {salvando ? "Salvando..." : "Salvar"}
            </button>
            {salvo && (
              <span
                role="status"
                className="text-sm font-bold text-[var(--color-on-surface-variant)]"
              >
                Salvo.
              </span>
            )}
          </div>

          {/*
            Quem configura precisa saber o que NÃO vai acontecer. Sem isto, o
            gestor que baixa o limite espera que o sistema tire gente das
            turmas — e depois descobre que não tirou.
          */}
          <p className="mt-3 text-sm text-[var(--color-on-surface-variant)]">
            O limite vale para novas entradas. Alunos que já estão em mais
            turmas do que o limite continuam nelas.
          </p>

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
