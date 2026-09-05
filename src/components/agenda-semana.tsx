"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  ApiError,
  getAgendaSemana,
  listCourts,
  type Court,
  type DiaComItens,
} from "@/lib/api-client";
import {
  AgendaSemanaAcoes,
  type AcaoDaSemana,
} from "@/components/agenda-semana-acoes";

const DIA_CURTO = new Intl.DateTimeFormat("pt-BR", {
  weekday: "short",
  day: "2-digit",
  timeZone: "UTC",
});

/** A janela padrão quando a semana está vazia: o expediente típico do clube. */
const HORA_MIN_PADRAO = 7;
const HORA_MAX_PADRAO = 22;

function chave(d: Date) {
  return d.toISOString().slice(0, 10);
}

/**
 * O domingo da semana de `d`.
 *
 * **Quem escolhe o primeiro dia é o cliente (D10)** — o servidor não adivinha
 * convenção de semana. Aqui é domingo, pelo mesmo `getUTCDay()` que o
 * calendário do mês já usa para alinhar a grade (`agenda-view.tsx`).
 */
function domingoDaSemana(d: Date) {
  const dom = new Date(d);
  dom.setUTCDate(dom.getUTCDate() - dom.getUTCDay());
  return dom;
}

function horaDe(hhmm: string) {
  return Number(hhmm.slice(0, 2));
}

/**
 * SPEC-034/REQ-001 — a semana, hora a hora.
 *
 * **Por que grade e não sete colunas de contagem:** o mês já mostra volume, e
 * o gestor que abre a semana quer ver *onde* estão os buracos. Sem as horas
 * ele não teria como clicar num vão para criar, nem como julgar se mover uma
 * reserva faz sentido — as duas coisas que a spec entrega.
 *
 * A faixa de horas **sai dos itens**, não de uma constante: um clube que abre
 * às 6h e fecha à meia-noite não pode ter reserva escondida fora da janela.
 * O padrão 7h–22h vale só quando a semana está vazia.
 */
export function AgendaSemana() {
  const [inicio, setInicio] = useState(() => chave(domingoDaSemana(new Date())));
  const [dias, setDias] = useState<DiaComItens[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [quadras, setQuadras] = useState<Court[]>([]);
  const [quadraId, setQuadraId] = useState("");
  const [acao, setAcao] = useState<AcaoDaSemana | null>(null);

  const carregar = useCallback(async (alvo: string) => {
    setCarregando(true);
    setErro(null);
    try {
      setDias(await getAgendaSemana(alvo));
    } catch (e) {
      setErro(
        e instanceof ApiError ? e.message : "Não foi possível carregar a semana.",
      );
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void carregar(inicio);
  }, [inicio, carregar]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void listCourts(1, 100)
      .then((p) => setQuadras(p.data.filter((q) => q.status === "ativa")))
      .catch(() => setQuadras([]));
  }, []);

  function navegar(semanas: number) {
    const d = new Date(`${inicio}T00:00:00.000Z`);
    d.setUTCDate(d.getUTCDate() + semanas * 7);
    setInicio(chave(d));
  }

  const horas = useMemo(() => {
    const todas = dias.flatMap((d) => d.itens.map((i) => horaDe(i.horaInicio)));
    const fins = dias.flatMap((d) => d.itens.map((i) => horaDe(i.horaFim)));
    const min = todas.length ? Math.min(...todas, HORA_MIN_PADRAO) : HORA_MIN_PADRAO;
    // O fim é exclusivo na leitura da grade: uma reserva 21h–22h ocupa a
    // linha das 21h, então a última linha necessária é `fim - 1`.
    const max = fins.length ? Math.max(...fins.map((h) => h - 1), HORA_MAX_PADRAO) : HORA_MAX_PADRAO;
    return Array.from({ length: max - min + 1 }, (_, i) => min + i);
  }, [dias]);

  const nomeDaQuadra = quadras.find((q) => q.id === quadraId)?.nome ?? "";

  const rotulo = dias.length
    ? `${DIA_CURTO.format(new Date(`${dias[0].data}T00:00:00.000Z`))} – ${DIA_CURTO.format(new Date(`${dias[6].data}T00:00:00.000Z`))}`
    : "";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="min-w-48 font-medium capitalize">{rotulo}</span>
        <div className="flex flex-wrap items-center gap-2">
          {/*
            AC-022 exige que o vao abra a criacao com data, hora E QUADRA
            pre-preenchidas -- e uma grade dia x hora nao identifica a quadra
            sozinha. Com "todas", o vao mostra o que existe mas nao cria:
            oferecer um botao que nao sabe onde reservar seria pior do que
            nao oferecer, que e a regra que o agenda-dia-dialog ja segue.
          */}
          <select
            aria-label="Quadra"
            value={quadraId}
            onChange={(e) => setQuadraId(e.target.value)}
            className="rounded-lg border border-border bg-[var(--color-surface)] p-2 text-sm"
          >
            <option value="">Todas as quadras</option>
            {quadras.map((q) => (
              <option key={q.id} value={q.id}>
                {q.nome}
              </option>
            ))}
          </select>
          <Button type="button" variant="outline" aria-label="Semana anterior" onClick={() => navegar(-1)}>
            <ChevronLeft className="size-4" />
          </Button>
          <Button type="button" variant="outline" onClick={() => setInicio(chave(domingoDaSemana(new Date())))}>
            Hoje
          </Button>
          <Button type="button" variant="outline" aria-label="Próxima semana" onClick={() => navegar(1)}>
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>

      {erro ? (
        <p role="alert" className="text-[var(--color-error)]">
          {erro}
        </p>
      ) : carregando ? (
        <p className="text-[var(--color-on-surface-variant)]">Carregando...</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-[var(--color-surface)]">
          <table className="w-full min-w-3xl border-collapse text-sm">
            <thead>
              <tr>
                <th className="w-14 border-b border-border p-2 text-xs font-medium text-[var(--color-on-surface-variant)]">
                  h
                </th>
                {dias.map((d) => (
                  <th
                    key={d.data}
                    className={`border-b border-l border-border p-2 text-xs font-medium capitalize ${
                      d.fechado ? "text-[var(--color-on-surface-variant)]" : ""
                    }`}
                  >
                    {DIA_CURTO.format(new Date(`${d.data}T00:00:00.000Z`))}
                    {/* Fechado é informação, não ausência dela (SPEC-010). */}
                    {d.fechado ? (
                      <span className="block text-[11px] font-normal">fechado</span>
                    ) : null}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {horas.map((h) => (
                <tr key={h}>
                  <th className="border-b border-border p-2 align-top text-xs font-normal text-[var(--color-on-surface-variant)]">
                    {String(h).padStart(2, "0")}h
                  </th>
                  {dias.map((d) => {
                    const itens = d.itens.filter(
                      (i) =>
                        horaDe(i.horaInicio) === h &&
                        (quadraId === "" || i.quadraNome === nomeDaQuadra),
                    );
                    return (
                      <td
                        key={`${d.data}-${h}`}
                        className={`min-w-28 border-b border-l border-border p-1 align-top ${
                          d.fechado ? "bg-[var(--color-surface-variant)]" : ""
                        }`}
                      >
                        {itens.length === 0 ? (
                          <button
                            type="button"
                            aria-label={`Criar reserva em ${d.data} às ${String(h).padStart(2, "0")}:00`}
                            disabled={d.fechado || quadraId === ""}
                            title={quadraId === "" ? "Escolha uma quadra para criar" : undefined}
                            onClick={() =>
                              setAcao({ tipo: "criar", data: d.data, hora: h, quadraId })
                            }
                            className="h-10 w-full rounded transition-colors hover:bg-accent disabled:cursor-default disabled:hover:bg-transparent"
                          />
                        ) : (
                          itens.map((i) => (
                            <button
                              key={i.id}
                              type="button"
                              onClick={() =>
                                setAcao(
                                  i.origemTipo === "TURMA"
                                    ? { tipo: "cancelar-aula", item: i, data: d.data }
                                    : { tipo: "mover", item: i, data: d.data },
                                )
                              }
                              className={`mb-1 block w-full rounded px-2 py-1 text-left text-xs transition-colors hover:opacity-90 ${
                                i.origemTipo === "TURMA"
                                  ? "bg-[var(--color-secondary-container)] text-[var(--color-on-secondary-container)]"
                                  : i.statusPagamento === "pago"
                                    ? "bg-[var(--color-primary-container)] text-[var(--color-on-primary-container)]"
                                    : "bg-[var(--color-tertiary-container)] text-[var(--color-on-tertiary-container)]"
                              }`}
                            >
                              <span className="block font-medium">
                                {i.horaInicio}–{i.horaFim}
                              </span>
                              <span className="block truncate">
                                {i.responsavel ?? "sem responsável"}
                              </span>
                              <span className="block truncate opacity-80">
                                {i.quadraNome}
                              </span>
                            </button>
                          ))
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {acao ? (
        <AgendaSemanaAcoes
          acao={acao}
          onFechar={() => setAcao(null)}
          onMudou={() => void carregar(inicio)}
        />
      ) : null}
    </div>
  );
}
