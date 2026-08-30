"use client";

import { useEffect, useState } from "react";
import { CalendarCheck, ChevronDown } from "lucide-react";
import {
  ApiError,
  listPresencasDaTurma,
  registrarNaoHouveAula,
  type OcorrenciaPresenca,
} from "@/lib/api-client";

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
  const [registrando, setRegistrando] = useState<string | null>(null);

  function carregar() {
    return listPresencasDaTurma(turmaId)
      .then(setOcorrencias)
      .catch((err: unknown) =>
        setErro(
          err instanceof ApiError ? err.message : "Não foi possível carregar as presenças.",
        ),
      );
  }

  useEffect(() => {
    void carregar().finally(() => setCarregando(false));
    // `turmaId` é a única entrada: recarregar por causa de `carregar` mudando
    // de identidade a cada render faria a tela buscar em laço.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turmaId]);

  /**
   * SPEC-030 — o gestor declara que a aula não aconteceu.
   *
   * Relê a lista inteira depois de gravar, em vez de remendar a linha: a
   * ocorrência muda de grupo (sai de "sem chamada", entra em "Presenças"), e
   * um remendo local teria de reproduzir a regra de agrupamento que o
   * servidor já resolveu.
   */
  async function naoHouve(ocupacaoId: string) {
    if (
      !window.confirm(
        "Registrar que esta aula NÃO aconteceu?\n\n" +
          "Ela deixa de aparecer como pendente para o professor e não conta " +
          "na frequência de ninguém.",
      )
    ) {
      return;
    }
    setErro(null);
    setRegistrando(ocupacaoId);
    try {
      await registrarNaoHouveAula(turmaId, ocupacaoId);
      await carregar();
    } catch (err) {
      setErro(
        err instanceof ApiError
          ? err.message
          : "Não foi possível registrar. Tente de novo.",
      );
    } finally {
      setRegistrando(null);
    }
  }

  const comChamada = ocorrencias.filter((o) => o.chamadaFeita);
  /**
   * **SPEC-030 — as aulas que ninguém respondeu, e elas não apareciam aqui.**
   *
   * Esta tela sempre filtrou por `chamadaFeita`, então a aula pendente — a
   * única sobre a qual o gestor tem o que fazer — era invisível para ele. Com
   * o professor ainda no clube isso era coerente (quem lança é ele); quando o
   * professor sai, ninguém mais tem caminho, e o dia fica vermelho para
   * sempre no calendário.
   *
   * Só `pendente`: `futura` e `em_andamento` não são pendência de ninguém
   * ainda, e `cancelada` não vai acontecer.
   */
  const pendentes = ocorrencias.filter((o) => o.estado === "pendente");

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

      {/* SPEC-030 — o grupo novo, e ele vem ANTES: é a única parte desta tela
          sobre a qual o gestor tem uma ação. */}
      {pendentes.length > 0 ? (
        <div className="flex flex-col gap-2 rounded-lg border border-[var(--color-outline-variant)] p-4">
          <h3 className="text-sm font-semibold text-[var(--color-on-surface)]">
            Aulas sem chamada ({pendentes.length})
          </h3>
          {/* Diz de quem é a ação primeiro, e só depois oferece a saída: o
              caminho normal continua sendo o professor lançar a chamada. */}
          <p className="text-xs text-[var(--color-on-surface-variant)]">
            Já terminaram e ninguém registrou. Quem lança a chamada é o
            professor, pelo app dele — mas se a aula não chegou a acontecer
            (chuva, clube fechado, professor que saiu), registre aqui para ela
            parar de aparecer como pendente.
          </p>
          <ul className="flex flex-col gap-2">
            {pendentes.map((o) => (
              <li
                key={o.ocupacaoId}
                className="flex items-center gap-3 rounded-lg border border-border p-3"
              >
                <span className="font-medium">
                  {o.data.split("-").reverse().join("/")}
                </span>
                <span className="text-sm text-[var(--color-on-surface-variant)]">
                  {o.horaInicio}–{o.horaFim}
                </span>
                <button
                  type="button"
                  disabled={registrando === o.ocupacaoId}
                  onClick={() => void naoHouve(o.ocupacaoId)}
                  className="ml-auto rounded-lg border border-border px-3 py-1.5 text-sm font-medium disabled:opacity-60"
                >
                  {registrando === o.ocupacaoId
                    ? "Registrando..."
                    : "A aula não aconteceu"}
                </button>
              </li>
            ))}
          </ul>
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
                {/* SPEC-030 — `chamadaFeita` passou a incluir `nao_houve`, e
                    ela tem ZERO presenças: sem este ramo a linha diria
                    "0/0 presentes", que sugere uma chamada lançada vazia. */}
                {o.estado === "nao_houve" ? (
                  <span className="rounded-full bg-[var(--color-surface-variant)] px-2 py-0.5 text-xs">
                    aula não realizada
                  </span>
                ) : null}
                <span className="ml-auto text-sm text-[var(--color-on-surface-variant)]">
                  {o.estado === "nao_houve"
                    ? "sem chamada"
                    : `${presentes}/${o.alunos.length} presentes`}
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
