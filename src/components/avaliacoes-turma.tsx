"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Star } from "lucide-react";
import {
  ApiError,
  getAvaliacoesDaTurma,
  type AvaliacoesDaTurma,
} from "@/lib/api-client";

/**
 * SPEC-025 — **as avaliações da turma, do lado do gestor.**
 *
 * O pedido do Israel foi literal: *"identificar com facilidade os
 * detratores"*. Por isso esta tela é diferente de uma lista comum em três
 * pontos, e os três são a funcionalidade:
 *
 * 1. **vem ordenada por pior nota**, não por data. Ordenar por data — o
 *    reflexo — enterraria o 1 da semana passada embaixo dos 5 de ontem;
 * 2. **a contagem de detratores aparece antes da lista**, para o gestor
 *    saber se precisa ler;
 * 3. **cada linha mostra a data da AULA**, não a do registro: é ela que diz
 *    qual terça-feira investigar.
 *
 * A ordem e a régua vêm calculadas do servidor. Se a tela ordenasse ou
 * comparasse, as duas virariam segundas cópias da regra — e é sempre a cópia
 * que fica velha.
 */
export function AvaliacoesTurma({ turmaId }: { turmaId: string }) {
  const [dados, setDados] = useState<AvaliacoesDaTurma | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    getAvaliacoesDaTurma(turmaId)
      .then(setDados)
      .catch((e: unknown) =>
        setErro(
          e instanceof ApiError
            ? e.message
            : "Não foi possível carregar as avaliações.",
        ),
      );
  }, [turmaId]);

  if (erro) {
    return (
      <p role="alert" className="text-sm text-[var(--color-error)]">
        {erro}
      </p>
    );
  }

  if (!dados) {
    return (
      <p className="text-sm text-[var(--color-on-surface-variant)]">
        Carregando...
      </p>
    );
  }

  if (dados.itens.length === 0) {
    return (
      <p className="text-sm text-[var(--color-on-surface-variant)]">
        Nenhum aluno avaliou as aulas desta turma ainda.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/*
        O resumo vem primeiro para o gestor decidir se precisa ler a lista.
        Sem ele, achar os detratores exigiria varrer linha a linha — que é
        exatamente o trabalho que o pedido queria evitar.
      */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm font-bold">
          {dados.itens.length}{" "}
          {dados.itens.length === 1 ? "avaliação" : "avaliações"}
        </span>
        {dados.detratores > 0 ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-error)]/10 px-3 py-1 text-sm font-bold text-[var(--color-error)]">
            <AlertTriangle className="size-4" aria-hidden="true" />
            {dados.detratores}{" "}
            {dados.detratores === 1 ? "detrator" : "detratores"}
          </span>
        ) : (
          <span className="text-sm text-[var(--color-on-surface-variant)]">
            Nenhum detrator (nota {dados.notaMaximaDeDetrator} ou menos).
          </span>
        )}
      </div>

      <ul className="flex flex-col gap-2">
        {dados.itens.map((item, i) => (
          <li
            key={`${item.alunoNome}-${item.dataDaAula}-${i}`}
            className={`rounded-lg border p-3 ${
              item.detrator
                ? "border-[var(--color-error)]/40 bg-[var(--color-error)]/5"
                : "border-[var(--color-outline)]"
            }`}
          >
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <Estrelas nota={item.nota} />
              <span className="font-bold">{item.alunoNome}</span>
              <span className="text-sm text-[var(--color-on-surface-variant)]">
                aula de {formatarData(item.dataDaAula)} às {item.horaInicio}
              </span>
            </div>
            {item.comentario && (
              // `whitespace-pre-wrap`: o texto é puro, e as quebras de linha
              // do aluno são preservadas. Sem markdown nem HTML — HTML vindo
              // do aluno seria XSS neste painel.
              <p className="mt-2 text-sm whitespace-pre-wrap">
                {item.comentario}
              </p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Estrelas({ nota }: { nota: number }) {
  return (
    <span
      className="inline-flex items-center gap-0.5"
      aria-label={`Nota ${nota} de 5`}
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={`size-4 ${
            n <= nota
              ? "fill-[var(--color-primary)] text-[var(--color-primary)]"
              : "text-[var(--color-outline)]"
          }`}
          aria-hidden="true"
        />
      ))}
    </span>
  );
}

function formatarData(data: string): string {
  const [ano, mes, dia] = data.split("-");
  return `${dia}/${mes}/${ano}`;
}
