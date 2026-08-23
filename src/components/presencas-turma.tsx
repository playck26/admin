"use client";

import { useEffect, useState } from "react";
import { CalendarCheck, ChevronDown } from "lucide-react";
import { ApiError, listPresencasDaTurma, type OcorrenciaPresenca } from "@/lib/api-client";

const ROTULO: Record<string, string> = {
  presente: "Veio",
  ausente: "Faltou",
  justificado: "Justificou",
};

const COR: Record<string, string> = {
  presente: "text-[var(--color-primary)]",
  ausente: "text-[var(--color-error)]",
  justificado: "text-[var(--color-on-surface-variant)]",
};

/**
 * SPEC-014/AC-009 — o histórico de chamada, do lado do gestor.
 *
 * Só leitura (LIM-002). Duas coisas que a tela mostra de propósito:
 *
 * - **Aula cancelada com chamada** aparece, marcada como cancelada. É o
 *   AC-012: cancelar depois não desfaz quem esteve lá, e esconder a chamada
 *   faria o gestor achar que ela nunca existiu.
 * - **Aluno inativo ou fora da turma** vem sinalizado. A spec decidiu que
 *   alocação é o único requisito para marcar presença — presença registra o
 *   que aconteceu. O sinalizador é o que impede essa decisão de virar
 *   omissão silenciosa.
 */
export function PresencasTurma({ turmaId }: { turmaId: string }) {
  const [ocorrencias, setOcorrencias] = useState<OcorrenciaPresenca[]>([]);
  const [aberta, setAberta] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    listPresencasDaTurma(turmaId)
      .then(setOcorrencias)
      .catch((err: unknown) =>
        setErro(
          err instanceof ApiError ? err.message : "Não foi possível carregar as presenças.",
        ),
      )
      .finally(() => setCarregando(false));
  }, [turmaId]);

  const comChamada = ocorrencias.filter((o) => o.chamadaFeita);

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold text-[var(--color-on-surface)]">Presenças</h2>

      {carregando ? (
        <p className="text-sm text-[var(--color-on-surface-variant)]">Carregando...</p>
      ) : null}

      {erro ? (
        <p role="alert" className="text-sm text-[var(--color-error)]">
          {erro}
        </p>
      ) : null}

      {!carregando && !erro && comChamada.length === 0 ? (
        <div className="flex items-center gap-3 rounded-lg border border-border p-4 text-sm text-[var(--color-on-surface-variant)]">
          <CalendarCheck className="size-5 shrink-0" aria-hidden="true" />
          {/* Estado vazio que diz de quem é a ação: sem isso o gestor não
              sabe se o sistema falhou ou se o professor ainda não lançou. */}
          <span>
            Nenhuma chamada lançada nos últimos 30 dias. Quem lança é o professor
            da turma, pelo app dele.
          </span>
        </div>
      ) : null}

      <ul className="flex flex-col gap-2">
        {comChamada.map((o) => {
          const abertaAqui = aberta === o.ocupacaoId;
          const presentes = o.alunos.filter((a) => a.status === "presente").length;
          return (
            <li key={o.ocupacaoId} className="rounded-lg border border-border">
              <button
                type="button"
                onClick={() => setAberta(abertaAqui ? null : o.ocupacaoId)}
                aria-expanded={abertaAqui}
                className="flex w-full items-center gap-3 p-4 text-left"
              >
                <span className="font-medium">{o.data.split("-").reverse().join("/")}</span>
                {o.cancelada ? (
                  <span className="rounded-full bg-[var(--color-surface-variant)] px-2 py-0.5 text-xs">
                    aula cancelada depois
                  </span>
                ) : null}
                <span className="ml-auto text-sm text-[var(--color-on-surface-variant)]">
                  {presentes}/{o.alunos.length} presentes
                </span>
                <ChevronDown
                  className={`size-4 transition-transform ${abertaAqui ? "rotate-180" : ""}`}
                  aria-hidden="true"
                />
              </button>

              {abertaAqui ? (
                <div className="flex flex-col gap-2 border-t border-border p-4">
                  {o.registradoPor ? (
                    <p className="text-xs text-[var(--color-on-surface-variant)]">
                      Lançada por {o.registradoPor}
                    </p>
                  ) : null}
                  <ul className="flex flex-col gap-1.5">
                    {o.alunos.map((a) => (
                      <li key={a.alunoId} className="flex items-center gap-2 text-sm">
                        <span>{a.nome}</span>
                        {!a.naTurmaHoje ? (
                          <span className="text-xs text-[var(--color-on-surface-variant)]">
                            (saiu da turma)
                          </span>
                        ) : null}
                        {!a.alunoAtivo ? (
                          <span className="text-xs text-[var(--color-on-surface-variant)]">
                            (inativo)
                          </span>
                        ) : null}
                        <span className={`ml-auto font-medium ${COR[a.status]}`}>
                          {ROTULO[a.status]}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
