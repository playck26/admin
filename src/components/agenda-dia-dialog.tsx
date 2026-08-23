"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  ApiError,
  cancelBooking,
  getAgendaDia,
  updateBookingPaymentStatus,
  type ItemDoDia,
} from "@/lib/api-client";

const DIA_LONGO = new Intl.DateTimeFormat("pt-BR", {
  weekday: "long",
  day: "2-digit",
  month: "2-digit",
  timeZone: "UTC",
});

/**
 * SPEC-012/REQ-002 e REQ-003 — o detalhe do dia, que mostra **e** age.
 *
 * As ações reusam os endpoints que já existem (`CON-005.6`, `CON-006.3`).
 * Nenhuma rota de escrita nova: criar caminho paralelo para as mesmas
 * ações duplicaria regra de autorização.
 */
export function AgendaDiaDialog({
  data,
  onFechar,
  onMudou,
}: {
  data: string;
  onFechar: () => void;
  onMudou: () => void;
}) {
  const [itens, setItens] = useState<ItemDoDia[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [processando, setProcessando] = useState<string | null>(null);

  function carregar() {
    return getAgendaDia(data)
      .then(setItens)
      .catch((e: unknown) =>
        setErro(e instanceof ApiError ? e.message : "Não foi possível carregar o dia."),
      );
  }

  useEffect(() => {
    void carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  async function agir(id: string, acao: () => Promise<unknown>) {
    setErro(null);
    setProcessando(id);
    try {
      await acao();
      await carregar();
      onMudou();
    } catch (e) {
      // AC-013: o motivo mais provável de falhar aqui é a tela estar
      // velha — outro admin já cancelou a reserva. Recarregar o dia é a
      // resposta certa, e a mensagem do servidor já explica.
      setErro(e instanceof ApiError ? e.message : "Não foi possível concluir.");
      await carregar();
    } finally {
      setProcessando(null);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label={`Reservas de ${data}`}
      onClick={onFechar}
    >
      <div
        className="max-h-[80vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-[var(--color-surface)] p-6 shadow-[var(--shadow-elevated)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 className="text-lg font-semibold capitalize">
            {DIA_LONGO.format(new Date(`${data}T00:00:00.000Z`))}
          </h2>
          <button
            type="button"
            onClick={onFechar}
            aria-label="Fechar"
            className="rounded-full p-1 text-[var(--color-on-surface-variant)] hover:bg-accent"
          >
            <X className="size-5" />
          </button>
        </div>

        {itens === null ? (
          <p className="text-[var(--color-on-surface-variant)]">Carregando...</p>
        ) : itens.length === 0 ? (
          <p className="text-[var(--color-on-surface-variant)]">
            Nenhuma reserva neste dia.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {itens.map((item) => (
              <li
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-[var(--color-surface-variant)] px-4 py-3"
              >
                <div>
                  <p className="font-medium">
                    {item.horaInicio}–{item.horaFim} · {item.quadraNome}
                  </p>
                  <p className="text-sm text-[var(--color-on-surface-variant)]">
                    {item.responsavel ?? "sem responsável"}
                    {item.origemTipo === "TURMA" ? " · turma" : ""}
                    {item.origemTipo === "AVULSO"
                      ? ` · ${item.statusPagamento === "pago" ? "pago" : "pendente"}`
                      : ""}
                  </p>
                </div>

                {/*
                  AC-007: linha de turma não mostra **nenhuma** ação de
                  reserva avulsa. Cancelar a ocorrência apagaria a aula da
                  agenda de todos os matriculados (GAP-008), e "marcar
                  pago" numa aula recorrente é estado sem significado — o
                  servidor recusa as duas desde SPEC-012:TASK-000, e
                  oferecer botão que falha é pior do que não oferecer.
                */}
                {item.origemTipo === "AVULSO" ? (
                  <div className="flex gap-2">
                    {item.statusPagamento !== "pago" ? (
                      <Button
                        type="button"
                        variant="outline"
                        disabled={processando === item.id}
                        onClick={() =>
                          void agir(item.id, () =>
                            updateBookingPaymentStatus(item.id, "pago"),
                          )
                        }
                      >
                        Marcar pago
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      variant="outline"
                      disabled={processando === item.id}
                      onClick={() => void agir(item.id, () => cancelBooking(item.id))}
                    >
                      Cancelar
                    </Button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}

        {erro ? (
          <p role="alert" className="mt-4 text-sm text-[var(--color-error)]">
            {erro}
          </p>
        ) : null}
      </div>
    </div>
  );
}
