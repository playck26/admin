"use client";

import { useState } from "react";
import { ApiError, listBookingEvents, type EventoDeOcupacao } from "@/lib/api-client";

/**
 * SPEC-032/TASK-004 — **a linha do tempo de uma reserva.**
 *
 * ## Por que ela faltava
 *
 * A rota `GET /bookings/:id/eventos` existe desde a SPEC-032, e
 * `listBookingEvents` estava no `api-client.ts` deste repositório **sem um
 * único chamador**. Função sem chamador é trabalho entregue que ninguém
 * alcança — e a spec pedia "histórico no diálogo do dia".
 *
 * O que já existia ali é o resumo (*"criada por X · cancelada por Y"*), que
 * vem junto do detalhe do dia e cobre o caso comum. **Isto aqui é o
 * aprofundamento**, e por isso carrega **sob demanda**: a lista do dia traz
 * dezenas de reservas, e uma ida à rede por linha seria pagar N requisições
 * para mostrar uma.
 *
 * ## O vocabulário é DUPLO, e mostrar os dois é o ponto
 *
 * Cada evento tem `tipo` (o efeito TÉCNICO sobre esta ocupação: `movida`) e
 * `acao` (o GESTO humano que o provocou: `reserva_movida`, `turma_horario_editado`).
 * **Eles não são sinônimos**, e é justamente aí que mora o valor de investigar:
 * uma ocupação `cancelada` cuja ação foi `turma_inativada` conta uma história
 * diferente de uma cancelada por `reserva_cancelada`.
 *
 * Mostrar só um dos dois transformaria a tela numa tradução com perda — e a
 * spec separou os dois campos exatamente para não perder.
 */
const RÓTULO_DA_AÇÃO: Record<string, string> = {
  reserva_criada: "reserva criada",
  reserva_cancelada: "reserva cancelada",
  reserva_movida: "reserva movida",
  aula_cancelada: "aula cancelada",
  pagamento_confirmado: "pagamento confirmado",
  turma_criada: "turma criada",
  turma_horario_editado: "horário da turma editado",
  credito_lancado: "crédito lançado",
  credito_retirado: "crédito retirado",
  turma_aluno_removido: "aluno removido da turma",
  turma_inativada: "turma inativada",
  turma_reativada: "turma reativada",
  aula_reativada: "aula reativada",
};

/**
 * **Data e HORA, no fuso do navegador do gestor.**
 *
 * Investigar um caso é responder "quando"; só a data não serve, porque duas
 * ações do mesmo dia são a pergunta mais comum. E aqui o fuso do navegador é o
 * certo — diferente da agenda, que é a do clube: quem lê um log quer a hora do
 * relógio que ele estava olhando.
 */
function quando(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function LinhaDoTempoDaReserva({ id }: { id: string }) {
  const [aberto, setAberto] = useState(false);
  const [eventos, setEventos] = useState<EventoDeOcupacao[] | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function alternar() {
    if (aberto) {
      setAberto(false);
      return;
    }
    setAberto(true);
    // **Busca uma vez e guarda.** Evento é append-only (INV-061: `UPDATE` e
    // `DELETE` são recusados pela trigger), então a lista não muda enquanto o
    // diálogo está aberto — reconsultar a cada abertura seria rede por nada.
    if (eventos !== null || carregando) return;
    setCarregando(true);
    setErro(null);
    try {
      setEventos(await listBookingEvents(id));
    } catch (e) {
      setErro(
        e instanceof ApiError
          ? e.message
          : "Não foi possível carregar o histórico.",
      );
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="mt-1">
      <button
        type="button"
        onClick={() => void alternar()}
        aria-expanded={aberto}
        className="text-xs font-semibold text-[var(--color-primary)] underline"
      >
        {aberto ? "Ocultar histórico" : "Ver histórico"}
      </button>

      {aberto ? (
        erro ? (
          <p role="alert" className="mt-1 text-xs text-[var(--color-error)]">
            {erro}
          </p>
        ) : carregando || eventos === null ? (
          <p className="mt-1 text-xs text-[var(--color-on-surface-variant)]">
            Carregando histórico...
          </p>
        ) : eventos.length === 0 ? (
          /*
            LIM-032a — **linha anterior à spec nasceu sem evento**, e vazio aqui
            não é erro. "Sem histórico registrado" diz a verdade; "nenhum
            evento encontrado" soaria como falha de busca.
          */
          <p className="mt-1 text-xs text-[var(--color-on-surface-variant)]">
            Sem histórico registrado — esta reserva é anterior ao registro de
            ações.
          </p>
        ) : (
          <ol className="mt-2 flex flex-col gap-2 border-l-2 border-border pl-3">
            {eventos.map((evento, i) => (
              <li key={`${evento.em}-${i}`} className="text-xs">
                <p className="font-semibold">
                  {RÓTULO_DA_AÇÃO[evento.acao] ?? evento.acao}
                  {/*
                    O efeito técnico só aparece quando DIVERGE do gesto. Repetir
                    "reserva cancelada · cancelada" seria ruído; mostrar
                    "turma inativada · cancelada" é a informação inteira.
                  */}
                  {RÓTULO_DA_AÇÃO[evento.acao] !== `reserva ${evento.tipo}` &&
                  evento.acao !== evento.tipo ? (
                    <span className="font-normal text-[var(--color-on-surface-variant)]">
                      {" "}
                      · {evento.tipo}
                    </span>
                  ) : null}
                </p>
                <p className="text-[var(--color-on-surface-variant)]">
                  {quando(evento.em)} · {evento.autor.nome}
                </p>
                {/*
                  O motivo é nota interna e **só existe em ação que o exige**
                  (cancelar aula, por exemplo). Ausente é o normal, não falta
                  de dado — por isso não há placeholder.
                */}
                {evento.motivo ? (
                  <p className="mt-0.5 italic text-[var(--color-on-surface-variant)]">
                    “{String(evento.motivo)}”
                  </p>
                ) : null}
              </li>
            ))}
          </ol>
        )
      ) : null}
    </div>
  );
}
