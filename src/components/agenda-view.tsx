"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AgendaDiaDialog } from "@/components/agenda-dia-dialog";
import {
  COR_DO_TIPO,
  ROTULO_DO_TIPO,
  TIPOS_NA_ORDEM,
  rotuloDoDiaDoMes,
  type ContagemPorTipo,
} from "@/lib/visual-da-agenda";
import { AgendaSemana } from "@/components/agenda-semana";
import { ApiError, getAgendaMes, type DiaDaAgenda } from "@/lib/api-client";

const NOMES_DIAS = ["D", "S", "T", "Q", "Q", "S", "S"];
const MES_ANO = new Intl.DateTimeFormat("pt-BR", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

function chaveMes(d: Date) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/**
 * SPEC-012 — calendário mensal de todas as quadras.
 *
 * O calendário mostra **volume**, não detalhe: desenhar cada reserva na
 * célula deixaria o mês ilegível com 8 quadras × 16 horas. O número e o
 * indicador de pendência bastam para o gestor decidir onde clicar — o
 * detalhe abre no pop-up.
 */
/**
 * SPEC-060/AC-006 — **o Back antigo não manda as contagens.**
 *
 * Durante o rollout o Admin novo conversa com o Back velho. Ausência vira
 * objeto vazio: o dia continua mostrando o total, sem ponto nenhum — que é
 * exatamente o comportamento de antes desta spec. Ler `undefined` como zero
 * daria o mesmo resultado aqui, mas mentiria no rótulo ("0 aulas de turma").
 */
function porTipoDoDia(dia: {
  turmas?: number;
  particulares?: number;
  quadras?: number;
}): ContagemPorTipo {
  const { turmas, particulares, quadras } = dia;
  if (turmas === undefined || particulares === undefined || quadras === undefined) {
    return {};
  }
  return { TURMA: turmas, PARTICULAR: particulares, AVULSO: quadras };
}

export function AgendaView() {
  const [mes, setMes] = useState(() => chaveMes(new Date()));
  const [dias, setDias] = useState<DiaDaAgenda[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [diaAberto, setDiaAberto] = useState<string | null>(null);
  const [modo, setModo] = useState<"mes" | "semana">("mes");

  const carregar = useCallback(async (alvo: string) => {
    setCarregando(true);
    setErro(null);
    try {
      setDias(await getAgendaMes(alvo));
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : "Não foi possível carregar a agenda.");
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void carregar(mes);
  }, [mes, carregar]);

  function navegar(delta: number) {
    const [ano, m] = mes.split("-").map(Number);
    setMes(chaveMes(new Date(Date.UTC(ano, m - 1 + delta, 1))));
  }

  // Alinha o dia 1 na coluna do dia da semana correto — sem isso, o mês
  // inteiro fica deslocado e o gestor lê sábado como quinta.
  const primeiroDiaSemana = dias.length
    ? new Date(`${dias[0].data}T00:00:00.000Z`).getUTCDay()
    : 0;

  return (
    <div className="flex flex-col gap-6 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[28px] leading-[34px] font-bold tracking-[-0.02em]">
          Agenda
        </h1>

        {/*
          SPEC-034 — mês e semana convivem, e o mês continua sendo o padrão.
          Eles respondem perguntas diferentes: o mês mostra VOLUME (é onde o
          gestor decide em que dia olhar), a semana mostra as HORAS (é onde ele
          opera). Trocar um pelo outro perderia metade.
        */}
        <div className="flex items-center gap-2">
          <div role="tablist" aria-label="Modo de visualização" className="flex gap-1">
            <Button
              type="button"
              role="tab"
              aria-selected={modo === "mes"}
              variant={modo === "mes" ? "default" : "outline"}
              onClick={() => setModo("mes")}
            >
              Mês
            </Button>
            <Button
              type="button"
              role="tab"
              aria-selected={modo === "semana"}
              variant={modo === "semana" ? "default" : "outline"}
              onClick={() => setModo("semana")}
            >
              Semana
            </Button>
          </div>

          {modo === "mes" ? (
            <>
              <Button type="button" variant="outline" aria-label="Mês anterior" onClick={() => navegar(-1)}>
                <ChevronLeft className="size-4" />
              </Button>
              <span className="min-w-40 text-center font-medium capitalize">
                {MES_ANO.format(new Date(`${mes}-01T00:00:00.000Z`))}
              </span>
              <Button type="button" variant="outline" aria-label="Próximo mês" onClick={() => navegar(1)}>
                <ChevronRight className="size-4" />
              </Button>
            </>
          ) : null}
        </div>
      </div>

      {modo === "semana" ? <AgendaSemana /> : null}

      {modo === "semana" ? null : erro ? (
        <p role="alert" className="text-[var(--color-error)]">
          {erro}
        </p>
      ) : carregando ? (
        <p className="text-[var(--color-on-surface-variant)]">Carregando...</p>
      ) : (
        <div className="rounded-2xl border border-border bg-[var(--color-surface)] p-4">
          <div className="mb-2 grid grid-cols-7 gap-2 text-center text-xs font-medium text-[var(--color-on-surface-variant)]">
            {NOMES_DIAS.map((d, i) => (
              <span key={`${d}-${i}`}>{d}</span>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-2">
            {Array.from({ length: primeiroDiaSemana }, (_, i) => (
              <span key={`vazio-${i}`} />
            ))}

            {dias.map((dia) => {
              const numero = Number(dia.data.slice(8, 10));
              return (
                <button
                  key={dia.data}
                  type="button"
                  onClick={() => setDiaAberto(dia.data)}
                  aria-label={rotuloDoDiaDoMes(
                    numero,
                    dia.total,
                    porTipoDoDia(dia),
                    dia.fechado,
                  )}
                  className={`flex min-h-20 flex-col items-start gap-1 rounded-lg border p-2 text-left transition-colors hover:border-primary ${
                    dia.fechado
                      ? "border-transparent bg-[var(--color-surface-variant)] opacity-60"
                      : "border-border bg-[var(--color-surface)]"
                  }`}
                >
                  <span className="text-sm font-medium">{numero}</span>

                  {/* Fechado é informação, não ausência dela (SPEC-010). */}
                  {dia.fechado && dia.total === 0 ? (
                    <span className="text-xs text-[var(--color-on-surface-variant)]">
                      fechado
                    </span>
                  ) : dia.total > 0 ? (
                    <>
                      <span className="text-xs text-[var(--color-on-surface-variant)]">
                        {dia.total} {dia.total === 1 ? "reserva" : "reservas"}
                      </span>
                      {/*
                        SPEC-060/D2 — um ponto por tipo PRESENTE no dia. A cor
                        não responde sozinha: o `aria-label` do dia diz por
                        extenso quantos de cada, e a legenda logo abaixo da
                        grade nomeia as três.
                      */}
                      <span className="flex items-center gap-1" aria-hidden="true">
                        {TIPOS_NA_ORDEM.map((tipo) => {
                          const n = porTipoDoDia(dia)[tipo];
                          if (!n) return null;
                          return (
                            <span
                              key={tipo}
                              data-ponto-do-tipo={tipo}
                              className="size-2 rounded-full"
                              style={{ backgroundColor: COR_DO_TIPO[tipo] }}
                            />
                          );
                        })}
                      </span>
                      {dia.pendentes > 0 ? (
                        <span className="rounded-full bg-[var(--color-tertiary-container)] px-2 py-0.5 text-[11px] font-medium text-[var(--color-on-tertiary-container)]">
                          {dia.pendentes} a receber
                        </span>
                      ) : null}
                    </>
                  ) : null}
                </button>
              );
            })}
          </div>

          {/*
            SPEC-060/REQ-003 — a legenda das três cores. Ela fica **dentro** do
            cartão da grade, colada nos pontos que explica: legenda longe do
            que explica é legenda que ninguém lê.
          */}
          <ul
            aria-label="Legenda dos tipos"
            className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border pt-3 text-xs font-medium text-[var(--color-on-surface-variant)]"
          >
            {TIPOS_NA_ORDEM.map((tipo) => (
              <li key={tipo} className="flex items-center gap-1.5">
                <span
                  aria-hidden="true"
                  className="size-2 rounded-full"
                  style={{ backgroundColor: COR_DO_TIPO[tipo] }}
                />
                {ROTULO_DO_TIPO[tipo]}
              </li>
            ))}
          </ul>
        </div>
      )}

      {diaAberto ? (
        <AgendaDiaDialog
          data={diaAberto}
          onFechar={() => setDiaAberto(null)}
          onMudou={() => void carregar(mes)}
        />
      ) : null}
    </div>
  );
}
