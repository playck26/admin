"use client";

import { useCallback, useEffect, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SeletorDeAluno } from "@/components/seletor-de-aluno";
import {
  ApiError,
  allocateStudentInClass,
  getAgendaDia,
  getClass,
  getVisitantesDaOcorrencia,
  removeStudentFromClass,
  type ItemDoDia,
  type SchoolClassDetail,
  type VisitanteDaOcorrencia,
} from "@/lib/api-client";
import { rotuloDaQuadra } from "@/lib/visual-da-agenda";
import { avisoDeAulaLotada } from "@/lib/aula-lotada";

/**
 * O texto do `409` de capacidade ao alocar. O servidor responde uma frase de
 * engenharia ("Capacidade da turma excedida (INV-003, AC-002)"), e o gestor
 * que acabou de ler "3 vagas nesta aula" precisa entender por que não cabe
 * mais ninguém NA TURMA.
 */
const SEM_VAGA_DE_MATRICULA =
  "A turma não tem vaga de matrícula. As vagas que aparecem nesta aula vêm de faltas avisadas — são vaga de reposição, não de matrícula.";

/**
 * SPEC-057/TASK-005/D17 e D18 (card 5349) — **a aula de turma, operável pela
 * agenda.**
 *
 * Carrega ao abrir, e não antes (D17): o detalhe da turma (matriculados, pelo
 * `GET /classes/:id` que já existia), os visitantes desta aula e as contagens
 * frescas do dia. As ações são as de matrícula que já existem (D18) — nenhuma
 * rota de escrita nova.
 *
 * **O que NÃO está aqui, de propósito:** "Marcar pago" e "Cancelar" de reserva
 * avulsa (SPEC-012/AC-007). Cancelar a aula tem rota própria (SPEC-034) e só
 * aparece quando quem abriu o diálogo sabe oferecê-la (`onCancelarAula`).
 *
 * **Erro não fecha o diálogo nem some com a linha.** Remover de forma
 * otimista mostraria uma saída que o servidor recusou — a aula já começou, e
 * o aluno continua na turma.
 */
export function AulaDaTurmaDialog({
  item,
  data,
  onFechar,
  onMudou,
  onCancelarAula,
}: {
  item: ItemDoDia;
  data: string;
  onFechar: () => void;
  onMudou: () => void;
  onCancelarAula?: () => void;
}) {
  const turmaId = item.origemTurmaId;
  const [turma, setTurma] = useState<SchoolClassDetail | null>(null);
  const [visitantes, setVisitantes] = useState<VisitanteDaOcorrencia[]>([]);
  const [contagens, setContagens] = useState<ItemDoDia>(item);
  const [erro, setErro] = useState<string | null>(null);
  const [processando, setProcessando] = useState<string | null>(null);
  const [novoAlunoId, setNovoAlunoId] = useState("");

  const carregar = useCallback(async () => {
    if (!turmaId) return;
    const [detalhe, deHoje, visitas] = await Promise.all([
      getClass(turmaId),
      getAgendaDia(data),
      getVisitantesDaOcorrencia(item.id),
    ]);
    setTurma(detalhe);
    setVisitantes(visitas);
    // As contagens vêm da agenda do dia, que usa a MESMA projeção das
    // oportunidades e do POST de reposição (D17). Se a aula sumiu do dia
    // (cancelada por outro gestor), ficam as que abriram o diálogo.
    const atual = deHoje.find((i) => i.id === item.id);
    if (atual) setContagens(atual);
  }, [turmaId, data, item.id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void carregar().catch((e: unknown) =>
      setErro(
        e instanceof ApiError ? e.message : "Não foi possível carregar a aula.",
      ),
    );
  }, [carregar]);

  async function agir(chave: string, acao: () => Promise<unknown>) {
    setErro(null);
    setProcessando(chave);
    try {
      await acao();
      setNovoAlunoId("");
      await carregar();
      onMudou();
    } catch (e) {
      // `AULA_LOTADA` (ADR-027) passa a mensagem do servidor inteira: ela diz
      // o DIA que lotaria. Trocá-la pelo texto de "vaga de matrícula" diria ao
      // gestor o motivo errado — a turma TEM vaga de matrícula.
      if (
        e instanceof ApiError &&
        e.status === 409 &&
        chave === "alocar" &&
        e.code !== "AULA_LOTADA"
      ) {
        setErro(SEM_VAGA_DE_MATRICULA);
      } else {
        setErro(e instanceof ApiError ? e.message : "Não foi possível concluir.");
      }
      // A tela pode estar velha — outro gestor mexeu na turma. Relê as
      // contagens sem desfazer nada que o servidor não desfez.
      await carregar().catch(() => undefined);
    } finally {
      setProcessando(null);
    }
  }

  const matriculados = turma?.alunos ?? [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label={`Aula de ${item.responsavel ?? "turma"}`}
      onClick={onFechar}
    >
      <div
        className="max-h-[85vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-[var(--color-surface)] p-6 shadow-[var(--shadow-elevated)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">
              {item.responsavel ?? "Aula de turma"}
            </h2>
            <p className="text-sm text-[var(--color-on-surface-variant)]">
              {data.split("-").reverse().join("/")} · {item.horaInicio}–
              {item.horaFim} ·{" "}
              {rotuloDaQuadra(item.quadraNome, item.quadraCodigoAgenda)}
            </p>
          </div>
          <button
            type="button"
            onClick={onFechar}
            aria-label="Fechar"
            className="rounded-full p-1 text-[var(--color-on-surface-variant)] hover:bg-accent"
          >
            <X className="size-5" />
          </button>
        </div>

        {/*
          D17 — duas perguntas, duas linhas. "Matrículas" é quem é da turma;
          "Ocupação desta aula" é quem vem hoje (membros sem falta avisada +
          visitantes). A soma usa as reposições que ENTRAM na ocupação, e não
          todas as marcadas: o membro que também marcou reposição conta uma vez.
        */}
        <dl className="mb-4 grid grid-cols-1 gap-1 text-sm sm:grid-cols-3">
          <div>
            <dt className="sr-only">Matrículas</dt>
            <dd className="font-medium">
              Matrículas {contagens.matriculados ?? 0}/{contagens.capacidade ?? 0}
            </dd>
          </div>
          <div>
            <dt className="sr-only">Ocupação desta aula</dt>
            <dd className="font-medium">
              Ocupação desta aula {contagens.ocupados ?? 0}/
              {contagens.capacidade ?? 0}
            </dd>
          </div>
          <div>
            <dt className="sr-only">Reposições marcadas</dt>
            <dd>Reposições marcadas {contagens.reposicoesMarcadas ?? 0}</dd>
          </div>
        </dl>

        <h3 className="mb-2 text-sm font-semibold">Matriculados</h3>
        {turma === null ? (
          <p className="text-sm text-[var(--color-on-surface-variant)]">Carregando...</p>
        ) : matriculados.length === 0 ? (
          <p className="text-sm text-[var(--color-on-surface-variant)]">
            Nenhum aluno matriculado.
          </p>
        ) : (
          <ul aria-label="Matriculados" className="mb-4 flex flex-col gap-2">
            {matriculados.map((a) => (
              <li
                key={a.alunoId}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-[var(--color-surface-variant)] px-3 py-2"
              >
                <span className="break-words">{a.nome}</span>
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11"
                  aria-label={`Remover ${a.nome} da turma`}
                  disabled={processando !== null}
                  onClick={() =>
                    void agir(`remover:${a.alunoId}`, () =>
                      removeStudentFromClass(turmaId as string, a.alunoId),
                    )
                  }
                >
                  Remover
                </Button>
              </li>
            ))}
          </ul>
        )}

        {turma?.proximaAulaLotada &&
        turma.alunosAlocados < turma.capacidade ? (
          // ADR-027 — antes de o gestor tentar: a turma tem vaga de matrícula,
          // mas uma próxima aula não comporta um aluno novo.
          <p role="status" className="mb-2 text-sm text-[var(--color-error)]">
            {avisoDeAulaLotada(turma.proximaAulaLotada)}
          </p>
        ) : null}

        <form
          className="mb-4 flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!novoAlunoId) return;
            void agir("alocar", () =>
              allocateStudentInClass(turmaId as string, novoAlunoId),
            );
          }}
        >
          <SeletorDeAluno
            id="aula-novo-aluno"
            label="Adicionar aluno"
            valor={novoAlunoId}
            onEscolher={setNovoAlunoId}
            excluir={matriculados.map((a) => a.alunoId)}
            disabled={processando !== null}
          />
          <Button
            type="submit"
            className="min-h-11 self-start"
            disabled={processando !== null || novoAlunoId === ""}
          >
            Adicionar à turma
          </Button>
        </form>

        <h3 className="mb-2 text-sm font-semibold">Visitantes desta aula</h3>
        {visitantes.length === 0 ? (
          <p className="mb-2 text-sm text-[var(--color-on-surface-variant)]">
            Nenhuma reposição marcada nesta aula.
          </p>
        ) : (
          <ul aria-label="Visitantes desta aula" className="mb-2 flex flex-col gap-2">
            {visitantes.map((v) => (
              <li
                key={v.alunoId}
                className="flex flex-wrap items-center gap-2 rounded-lg bg-[var(--color-surface-variant)] px-3 py-2"
              >
                <span className="break-words">{v.nome}</span>
                {v.nivelNome ? (
                  <span className="text-xs text-[var(--color-on-surface-variant)]">
                    {v.nivelNome}
                  </span>
                ) : null}
                <span className="rounded-full border border-border px-2 text-xs">
                  Reposição
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-[var(--color-on-surface-variant)]">
          Retirar a matrícula de um aluno não desmarca a reposição que ele tiver
          nesta aula.
        </p>

        {erro ? (
          <p role="alert" className="mt-4 text-sm text-[var(--color-error)]">
            {erro}
          </p>
        ) : null}

        <div className="mt-6 flex flex-wrap justify-end gap-2">
          {onCancelarAula ? (
            <Button type="button" variant="outline" onClick={onCancelarAula}>
              Cancelar esta aula
            </Button>
          ) : null}
          <Button type="button" variant="outline" onClick={onFechar}>
            Fechar
          </Button>
        </div>
      </div>
    </div>
  );
}
