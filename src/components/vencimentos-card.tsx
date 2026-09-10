"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { FormCard } from "@/components/form-card";
import {
  ApiError,
  listarVencimentos,
  type Vencimento,
  type Vencimentos,
} from "@/lib/api-client";

/**
 * SPEC-045/REQ-003 — **quem vence, e quem já venceu.**
 *
 * ## Por que esta tela existe
 *
 * A SPEC-037 vende plano com prazo, grava `fim` e o indexa. As duas telas
 * mostram a data **na ficha de cada aluno** — e nada agregava: para responder
 * *"quem vence este mês?"*, o gestor abria aluno por aluno. Medido em
 * 2026-09-10: dez fichas no clube de demonstração, a lista inteira num clube
 * real. Ninguém faz isso, e a renovação passava a depender de alguém lembrar.
 *
 * ## Dois grupos, e a ordem é a urgência (D3)
 *
 * **Vencidas primeiro:** quem já venceu está usando o clube sem plano vigente
 * agora. Quem vence em 20 dias ainda está em dia. Uma lista única ordenada por
 * data faria o topo alternar entre "cobre já" e "ligue depois" sem o gestor
 * perceber a diferença.
 *
 * ## A linha leva à ficha, e não matricula dali (AC-012)
 *
 * Matricular exige escolher plano e valor — um botão "renovar" na lista
 * esconderia a escolha, e renovação com desconto errado é dinheiro.
 */
const JANELAS = [7, 30, 60] as const;

function Linha({ v, vencida }: { v: Vencimento; vencida: boolean }) {
  return (
    <li className="flex items-center justify-between gap-3 border-b border-[var(--color-outline)] py-2 last:border-b-0">
      <div className="min-w-0">
        <Link
          href={`/pessoas/alunos/${v.alunoId}`}
          className="block truncate text-sm font-medium hover:underline"
        >
          {v.alunoNome}
        </Link>
        <p className="truncate text-xs text-[var(--color-on-surface-variant)]">
          {v.planoNome}
        </p>
      </div>
      <span
        className={
          vencida
            ? "shrink-0 text-xs font-semibold text-[var(--color-error)]"
            : "shrink-0 text-xs font-semibold"
        }
      >
        {/* `diasRestantes` é negativo quando venceu — a frase muda, o campo é
            o mesmo. Dois campos divergiriam no primeiro ajuste. */}
        {vencida
          ? `venceu há ${Math.abs(v.diasRestantes)} ${Math.abs(v.diasRestantes) === 1 ? "dia" : "dias"}`
          : v.diasRestantes === 0
            ? "vence hoje"
            : `vence em ${v.diasRestantes} ${v.diasRestantes === 1 ? "dia" : "dias"}`}
      </span>
    </li>
  );
}

export function VencimentosCard() {
  const [dias, setDias] = useState<number>(30);
  const [dados, setDados] = useState<Vencimentos | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    // **Nada de `setCarregando(true)` aqui.** O `react-hooks/set-state-in-effect`
    // reprova `setState` síncrono dentro do efeito, e ele tem razão: dispararia
    // uma segunda renderização antes da primeira pintar. O estado já nasce
    // `true`, e ao trocar a janela a lista anterior fica na tela até a nova
    // chegar — que é melhor do que piscar "Carregando..." a cada clique.
    listarVencimentos(dias)
      .then((d) => {
        // **A guarda existe por causa da corrida de fetch**, que este projeto
        // já pagou uma vez na grade da semana: trocar 30 → 7 dispara dois
        // pedidos, e o mais lento chegando por último pintaria a tela com a
        // janela que o gestor não escolheu.
        if (ativo) setDados(d);
      })
      .catch((e: unknown) => {
        if (ativo)
          setErro(
            e instanceof ApiError
              ? e.message
              : "Não foi possível carregar os vencimentos.",
          );
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });
    return () => {
      ativo = false;
    };
  }, [dias]);

  const vazio =
    dados !== null &&
    dados.vencidas.length === 0 &&
    dados.vencendo.length === 0;

  return (
    <FormCard
      title="Vencimento de matrícula"
      description="Quem já venceu e quem vence dentro da janela. Clique no nome para abrir a ficha e matricular de novo."
    >
      <div className="flex gap-2">
        {JANELAS.map((j) => (
          <button
            key={j}
            type="button"
            onClick={() => setDias(j)}
            aria-pressed={dias === j}
            className={
              dias === j
                ? "rounded-full bg-primary px-3 py-1 text-xs font-semibold text-white"
                : "rounded-full border border-[var(--color-outline)] px-3 py-1 text-xs font-semibold text-[var(--color-on-surface-variant)]"
            }
          >
            {j} dias
          </button>
        ))}
      </div>

      {erro ? (
        <p role="alert" className="mt-4 text-sm text-[var(--color-error)]">
          {erro}
        </p>
      ) : null}

      {carregando && dados === null ? (
        <p className="mt-4 text-sm text-[var(--color-on-surface-variant)]">
          Carregando...
        </p>
      ) : null}

      {vazio ? (
        <p className="mt-4 text-sm text-[var(--color-on-surface-variant)]">
          Ninguém vencendo nos próximos {dias} dias, e ninguém vencido sem
          renovar.
        </p>
      ) : null}

      {dados !== null && dados.vencidas.length > 0 ? (
        <section className="mt-4">
          <h3 className="text-sm font-semibold text-[var(--color-error)]">
            Vencidas ({dados.vencidas.length})
          </h3>
          <p className="mb-1 text-xs text-[var(--color-on-surface-variant)]">
            Estão sem plano vigente agora.
          </p>
          <ul>
            {dados.vencidas.map((v) => (
              <Linha key={v.alunoId} v={v} vencida />
            ))}
          </ul>
        </section>
      ) : null}

      {dados !== null && dados.vencendo.length > 0 ? (
        <section className="mt-6">
          <h3 className="text-sm font-semibold">
            Vencendo ({dados.vencendo.length})
          </h3>
          <p className="mb-1 text-xs text-[var(--color-on-surface-variant)]">
            Ainda em dia — dá tempo de renovar antes.
          </p>
          <ul>
            {dados.vencendo.map((v) => (
              <Linha key={v.alunoId} v={v} vencida={false} />
            ))}
          </ul>
        </section>
      ) : null}
    </FormCard>
  );
}
