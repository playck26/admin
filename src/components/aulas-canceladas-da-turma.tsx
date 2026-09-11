"use client";

import { useCallback, useEffect, useState } from "react";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DIAS_SEMANA } from "@/lib/dias-semana";
import {
  ApiError,
  listarAulasCanceladas,
  reativarOcorrenciaDeTurma,
  type AulaCancelada,
} from "@/lib/api-client";

/**
 * SPEC-035/TASK-004 — **as aulas canceladas desta turma, e o botão de
 * trazê-las de volta.**
 *
 * ## Por que esta seção existe
 *
 * Porque a agenda **esconde o que foi cancelado** — os três filtros de
 * `agenda.service.ts` trazem `status_pagamento <> 'cancelado'`, e isso está
 * certo para o que a agenda é: o que vai acontecer. O efeito colateral é que
 * a aula cancelada some da tela, e **não dá para reativar o que não se vê**.
 *
 * É literalmente o defeito que a SPEC-039 levou até a produção: a
 * funcionalidade existia, funcionava, e ninguém a alcançava. Construir a rota
 * `reactivate` sem esta lista seria repeti-lo de olhos abertos.
 *
 * ## O aviso de horário tomado vem ANTES do clique
 *
 * `horarioLivre` é calculado na leitura e **pode envelhecer** — quem decide é
 * a `EXCLUDE` no `POST`. O botão continua clicável quando o horário está
 * tomado, e é de propósito: o servidor pode ter uma verdade mais nova que a
 * desta tela, nos dois sentidos. O aviso reduz a tentativa inútil; desabilitar
 * mentiria sobre quem decide.
 */
export function AulasCanceladasDaTurma({ turmaId }: { turmaId: string }) {
  const [aulas, setAulas] = useState<AulaCancelada[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [motivos, setMotivos] = useState<Record<string, string>>({});
  const [emCurso, setEmCurso] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  /**
   * **Não liga `carregando` de novo a cada recarga**, e não é economia de
   * linha. `useEffect` chamando um `setState` síncrono dispara renderização em
   * cascata (`react-hooks/set-state-in-effect`), e o spinner na recarga não
   * ganharia nada: o botão já diz "Reativando...". `carregando` nasce `true` e
   * cai uma vez.
   */
  const recarregar = useCallback(async () => {
    try {
      setAulas(await listarAulasCanceladas(turmaId));
    } catch {
      setErro("Não foi possível carregar as aulas canceladas.");
    } finally {
      setCarregando(false);
    }
  }, [turmaId]);

  /**
   * O idioma do projeto para carga inicial: `.then` com sentinela `vivo`, o
   * mesmo de `disponibilidade-do-professor.tsx`. **Não é preferência de
   * estilo** — `void recarregar()` faz o `react-hooks/set-state-in-effect`
   * reprovar o efeito, e a sentinela ainda evita `setState` depois que a ficha
   * fechou.
   */
  useEffect(() => {
    let vivo = true;
    listarAulasCanceladas(turmaId)
      .then((lista) => {
        if (!vivo) return;
        setAulas(lista);
        setCarregando(false);
      })
      .catch(() => {
        if (!vivo) return;
        setErro("Não foi possível carregar as aulas canceladas.");
        setCarregando(false);
      });
    return () => {
      vivo = false;
    };
  }, [turmaId]);

  async function reativar(aula: AulaCancelada) {
    const motivo = motivos[aula.ocupacaoId] ?? "";
    setErro(null);
    setEmCurso(aula.ocupacaoId);
    try {
      await reativarOcorrenciaDeTurma(turmaId, aula.ocupacaoId, motivo);
      // Limpa o motivo daquela aula sem desestruturar para uma variável que
      // ninguém lê — `const { [id]: _, ...resto }` é o idioma comum e cai no
      // `no-unused-vars`.
      setMotivos((m) => {
        const resto = { ...m };
        delete resto[aula.ocupacaoId];
        return resto;
      });
      await recarregar();
    } catch (e) {
      // Pelo `code`, nunca pelo texto — a mesma razão do D7 da SPEC-033.
      const code = e instanceof ApiError ? e.code : undefined;
      const quem =
        e instanceof ApiError && e.conflictWith
          ? e.conflictWith.origemTipo === "TURMA"
            ? " Outra aula de turma tomou o lugar."
            : " Uma reserva avulsa tomou o lugar."
          : "";
      setErro(
        code === "HORARIO_OCUPADO"
          ? `Este horário já foi ocupado enquanto a aula estava cancelada.${quem}`
          : code === "PRAZO_DE_CANCELAMENTO"
            ? "Esta aula já começou. Para registrar que ela não aconteceu, use a chamada."
            : e instanceof ApiError
              ? e.message
              : "Não foi possível reativar a aula.",
      );
    } finally {
      setEmCurso(null);
    }
  }

  /** `2026-09-22` → `terça-feira, 22/09`. Sem `new Date(iso)`: fuso. */
  function porExtenso(iso: string): string {
    const [ano, mes, dia] = iso.split("-").map(Number);
    const diaSemana = new Date(Date.UTC(ano, mes - 1, dia)).getUTCDay();
    return `${DIAS_SEMANA[diaSemana]}, ${String(dia).padStart(2, "0")}/${String(mes).padStart(2, "0")}`;
  }

  if (carregando) {
    return (
      <p className="text-sm text-[var(--color-on-surface-variant)]">
        Carregando aulas canceladas...
      </p>
    );
  }

  if (aulas.length === 0) {
    return (
      <p className="text-sm text-[var(--color-on-surface-variant)]">
        Nenhuma aula cancelada desta turma daqui para frente.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {erro ? (
        <p
          role="alert"
          className="text-sm font-semibold text-[var(--color-error)]"
        >
          {erro}
        </p>
      ) : null}

      {aulas.map((aula) => (
        <div
          key={aula.ocupacaoId}
          className="flex flex-col gap-3 rounded-xl border border-border p-4"
        >
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="text-sm font-semibold">
              {porExtenso(aula.data)}
            </span>
            <span className="text-sm text-[var(--color-on-surface-variant)]">
              {aula.horaInicio}–{aula.horaFim} · {aula.quadraNome}
            </span>
          </div>

          {!aula.horarioLivre ? (
            <p className="text-xs font-medium text-[var(--color-error)]">
              O horário já foi ocupado por outra reserva. Reativar vai ser
              recusado enquanto ela existir.
            </p>
          ) : null}

          <div className="flex flex-col gap-2">
            <Label htmlFor={`motivo-${aula.ocupacaoId}`}>
              Motivo da reativação
            </Label>
            <Input
              id={`motivo-${aula.ocupacaoId}`}
              value={motivos[aula.ocupacaoId] ?? ""}
              onChange={(e) =>
                setMotivos((m) => ({
                  ...m,
                  [aula.ocupacaoId]: e.target.value,
                }))
              }
              placeholder="A quadra foi liberada"
              disabled={emCurso === aula.ocupacaoId}
              className="h-10 px-3"
            />
            <p className="text-xs text-[var(--color-on-surface-variant)]">
              O aluno vê a aula reaparecer na agenda; quem olhar o histórico
              três dias depois precisa saber por quê.
            </p>
          </div>

          <div className="flex justify-end">
            <Button
              type="button"
              variant="outline"
              // 3 a 280 é a regra do servidor (`CancelarOcorrenciaDto`).
              // Barrar aqui evita a ida que só voltaria `422`.
              disabled={
                emCurso === aula.ocupacaoId ||
                (motivos[aula.ocupacaoId] ?? "").trim().length < 3
              }
              onClick={() => void reativar(aula)}
              className="h-10 gap-2 border-[1.5px] border-primary px-5 text-[13px] font-semibold text-primary hover:bg-primary/5"
            >
              <RotateCcw className="size-4" />
              {emCurso === aula.ocupacaoId ? "Reativando..." : "Reativar aula"}
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
