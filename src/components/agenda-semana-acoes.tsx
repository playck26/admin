"use client";

import { useEffect, useState, type FormEvent } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  ApiError,
  cancelarOcorrenciaDeTurma,
  createBooking,
  listStudents,
  moveBooking,
  type ItemDoDia,
  type Student,
} from "@/lib/api-client";

function proximaHora(h: number) {
  return `${String(h + 1).padStart(2, "0")}:00`;
}

export type AcaoDaSemana =
  | { tipo: "criar"; data: string; hora: number; quadraId: string }
  | { tipo: "mover"; item: ItemDoDia; data: string }
  | { tipo: "cancelar-aula"; item: ItemDoDia; data: string };

/**
 * SPEC-034/TASK-008 — as três ações da grade da semana, num diálogo só.
 *
 * **Por que um só, e não três:** as três nascem do mesmo gesto (clicar numa
 * célula) e disputam o mesmo espaço da tela. Três componentes com o mesmo
 * cabeçalho, o mesmo tratamento de erro e o mesmo "recarregue depois" seriam
 * três lugares para a próxima correção esquecer um.
 *
 * O tratamento de erro é o do `agenda-dia-dialog`: **a mensagem do servidor é
 * exibida como veio**. `PRAZO_DE_CANCELAMENTO` e `FORA_DO_EXPEDIENTE` já
 * explicam a recusa melhor do que qualquer texto genérico daqui, e traduzir
 * cada código na tela criaria uma segunda cópia da regra.
 */
export function AgendaSemanaAcoes({
  acao,
  onFechar,
  onMudou,
}: {
  acao: AcaoDaSemana;
  onFechar: () => void;
  onMudou: () => void;
}) {
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [alunos, setAlunos] = useState<Student[]>([]);
  const [alunoId, setAlunoId] = useState("");
  const [motivo, setMotivo] = useState("");

  const [data, setData] = useState(acao.tipo === "criar" ? acao.data : acao.data);
  const [horaInicio, setHoraInicio] = useState(
    acao.tipo === "criar"
      ? `${String(acao.hora).padStart(2, "0")}:00`
      : acao.item.horaInicio,
  );
  const [horaFim, setHoraFim] = useState(
    acao.tipo === "criar" ? proximaHora(acao.hora) : acao.item.horaFim,
  );

  useEffect(() => {
    if (acao.tipo !== "criar") return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void listStudents(1, 100)
      .then((p) => setAlunos(p.data))
      .catch(() => setAlunos([]));
  }, [acao.tipo]);

  async function enviar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErro(null);
    setEnviando(true);
    try {
      if (acao.tipo === "criar") {
        await createBooking({
          quadraId: acao.quadraId,
          data,
          slots: [{ horaInicio, horaFim }],
          alunoId,
        });
      } else if (acao.tipo === "mover") {
        // **Só o que mudou.** O servidor compõe o destino a partir da linha
        // travada (D6); reenviar o resto seria mandar de volta um estado que
        // ele já tem e que pode ter mudado entre a leitura e o envio.
        const destino: Record<string, string> = {};
        if (data !== acao.data) destino.data = data;
        if (horaInicio !== acao.item.horaInicio) destino.horaInicio = horaInicio;
        if (horaFim !== acao.item.horaFim) destino.horaFim = horaFim;
        if (Object.keys(destino).length === 0) {
          setErro("Nada mudou. Ajuste a data ou o horário.");
          setEnviando(false);
          return;
        }
        await moveBooking(acao.item.id, destino);
      } else {
        const turmaId = acao.item.origemTurmaId;
        if (!turmaId) {
          setErro("Esta aula não tem turma de origem.");
          setEnviando(false);
          return;
        }
        await cancelarOcorrenciaDeTurma(turmaId, acao.item.id, motivo);
      }
      onMudou();
      onFechar();
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : "Não foi possível concluir.");
    } finally {
      setEnviando(false);
    }
  }

  const titulo =
    acao.tipo === "criar"
      ? "Nova reserva"
      : acao.tipo === "mover"
        ? "Mover reserva"
        : "Cancelar aula";

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label={titulo}
      onClick={onFechar}
    >
      <form
        onSubmit={(e) => void enviar(e)}
        className="w-full max-w-md rounded-2xl bg-[var(--color-surface)] p-6 shadow-[var(--shadow-elevated)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 className="text-lg font-semibold">{titulo}</h2>
          <button
            type="button"
            onClick={onFechar}
            aria-label="Fechar"
            className="rounded-full p-1 text-[var(--color-on-surface-variant)] hover:bg-accent"
          >
            <X className="size-5" />
          </button>
        </div>

        {acao.tipo === "cancelar-aula" ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-[var(--color-on-surface-variant)]">
              {acao.item.horaInicio}–{acao.item.horaFim} ·{" "}
              {acao.item.responsavel ?? "turma"} · {acao.item.quadraNome}
            </p>
            {/*
              D7 — o motivo é obrigatório porque o aluno vê a aula sumir da
              agenda e pergunta por quê. Sem ele, o gestor não tem o que
              responder três dias depois.
            */}
            <label className="flex flex-col gap-1 text-sm">
              Motivo
              <textarea
                required
                minLength={3}
                maxLength={280}
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Ex.: quadra interditada para manutenção"
                className="min-h-20 rounded-lg border border-border bg-[var(--color-surface)] p-2"
              />
            </label>
            <p className="text-xs text-[var(--color-on-surface-variant)]">
              A aula sai da agenda de todos os matriculados e a quadra fica
              livre. Aula que já começou não se cancela — para essa, use a
              chamada.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-sm">
              Data
              <input
                type="date"
                required
                value={data}
                onChange={(e) => setData(e.target.value)}
                className="rounded-lg border border-border bg-[var(--color-surface)] p-2"
              />
            </label>
            <div className="flex gap-3">
              <label className="flex flex-1 flex-col gap-1 text-sm">
                Início
                <input
                  type="time"
                  required
                  step={3600}
                  value={horaInicio}
                  onChange={(e) => setHoraInicio(e.target.value)}
                  className="rounded-lg border border-border bg-[var(--color-surface)] p-2"
                />
              </label>
              <label className="flex flex-1 flex-col gap-1 text-sm">
                Fim
                <input
                  type="time"
                  required
                  step={3600}
                  value={horaFim}
                  onChange={(e) => setHoraFim(e.target.value)}
                  className="rounded-lg border border-border bg-[var(--color-surface)] p-2"
                />
              </label>
            </div>

            {acao.tipo === "criar" ? (
              <label className="flex flex-col gap-1 text-sm">
                Aluno
                <select
                  required
                  value={alunoId}
                  onChange={(e) => setAlunoId(e.target.value)}
                  className="rounded-lg border border-border bg-[var(--color-surface)] p-2"
                >
                  <option value="">Selecione…</option>
                  {alunos.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.nome}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <p className="text-xs text-[var(--color-on-surface-variant)]">
                Mover não muda o aluno nem o valor — o preço fica congelado como
                foi criado. Reserva que já começou não se move.
              </p>
            )}
          </div>
        )}

        {erro ? (
          <p role="alert" className="mt-4 text-sm text-[var(--color-error)]">
            {erro}
          </p>
        ) : null}

        <div className="mt-6 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onFechar}>
            Voltar
          </Button>
          <Button type="submit" disabled={enviando}>
            {acao.tipo === "cancelar-aula" ? "Cancelar aula" : "Salvar"}
          </Button>
        </div>
      </form>
    </div>
  );
}
