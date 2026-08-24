"use client";

import { useEffect, useState } from "react";
import { getFrequenciaDaTurma, type FrequenciaDaTurma } from "@/lib/api-client";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

const JANELAS = [30, 60, 90] as const;

/**
 * SPEC-015/TASK-004 — a aba "Frequência" da turma.
 *
 * **A tela existe para o gestor decidir, e por isso a cobertura vem antes
 * dos percentuais**, não depois: sem saber quanto do período tem chamada,
 * qualquer número abaixo é uma afirmação sem lastro. Quando a confiança é
 * baixa, o servidor devolve `frequenciaPct: null` e aqui isso vira um
 * traço com explicação — nunca um zero, que seria acusação de aluno por
 * culpa de chamada não lançada.
 */
export function FrequenciaTurma({ turmaId }: { turmaId: string }) {
  const [dias, setDias] = useState<number>(30);
  const [dados, setDados] = useState<FrequenciaDaTurma | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  // "Carregando" é DERIVADO, não guardado: o payload traz `janelaDias`, e
  // o que a tela precisa saber é se o dado exibido é o da janela pedida.
  // Guardar um booleano exigiria `setState` no corpo do efeito (o que a
  // regra `react-hooks/set-state-in-effect` proíbe, com razão: é estado
  // que pode divergir do dado). Derivando, não há como divergir.
  const desatualizado = dados === null || dados.janelaDias !== dias;

  // O `setState` acontece só nos callbacks da promise, nunca no corpo do
  // efeito — é o padrão do `presencas-turma.tsx` e o que a regra
  // `react-hooks/set-state-in-effect` cobra. `vivo` evita escrever numa
  // tela que já saiu enquanto a requisição da janela anterior voltava.
  useEffect(() => {
    let vivo = true;
    getFrequenciaDaTurma(turmaId, dias)
      .then((d) => {
        if (!vivo) return;
        setDados(d);
        setErro(null);
      })
      .catch(() => {
        if (vivo) setErro("Não foi possível carregar a frequência. Tente de novo.");
      })
    return () => {
      vivo = false;
    };
  }, [turmaId, dias]);

  // O seletor de período é desenhado SEMPRE, inclusive no erro. Antes ele
  // vivia dentro do caminho feliz, e uma falha tirava da tela o único
  // controle capaz de disparar nova tentativa: a aba morria até recarregar
  // a página inteira.
  const seletor = (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm text-muted-foreground">Período:</span>
      {JANELAS.map((j) => (
        <button
          key={j}
          type="button"
          onClick={() => setDias(j)}
          className={`rounded-md border px-3 py-1 text-sm transition ${
            dias === j
              ? "border-primary bg-primary text-primary-foreground"
              : "border-input hover:bg-accent"
          }`}
        >
          {j} dias
        </button>
      ))}
    </div>
  );

  if (erro) {
    return (
      <div className="space-y-4">
        {seletor}
        <p className="text-sm text-destructive">{erro}</p>
      </div>
    );
  }
  if (desatualizado) {
    return (
      <div className="space-y-4">
        {seletor}
        <p className="py-6 text-sm text-muted-foreground">Carregando frequência…</p>
      </div>
    );
  }

  const { cobertura, alunos } = dados;

  return (
    <div className="space-y-6">
      {seletor}

      {/* AC-002/AC-013 — a cobertura vem primeiro, e em três números. */}
      <Card className="p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h3 className="text-sm font-semibold">Cobertura de chamada</h3>
          {cobertura.confianca === "baixa" ? (
            <Badge variant="secondary">Confiança baixa</Badge>
          ) : null}
        </div>
        <div className="mt-3 grid grid-cols-3 gap-4 text-center">
          <Numero rotulo="Aconteceram" valor={cobertura.aconteceram} />
          <Numero rotulo="Lançadas" valor={cobertura.lancadas} />
          <Numero
            rotulo="Completas"
            valor={cobertura.completas}
            destaque={cobertura.pctCompletas !== null ? `${cobertura.pctCompletas}%` : null}
          />
        </div>
        {/* AC-016 — o texto, porque o número sozinho leva à conclusão errada. */}
        {cobertura.aviso ? (
          <p className="mt-3 rounded-md bg-muted p-3 text-xs leading-relaxed text-muted-foreground">
            {cobertura.aviso}
          </p>
        ) : null}
      </Card>

      {alunos.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nenhum aluno matriculado nem com registro neste período.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2 pr-3 font-medium">Aluno</th>
                <th className="py-2 pr-3 font-medium">Frequência</th>
                <th className="py-2 pr-3 font-medium">Base</th>
                <th className="py-2 pr-3 font-medium">P / A / J</th>
                <th className="py-2 font-medium">Faltas seguidas</th>
              </tr>
            </thead>
            <tbody>
              {alunos.map((a) => (
                <tr key={a.alunoId} className="border-b last:border-0">
                  <td className="py-2 pr-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span>{a.nome}</span>
                      {/* AC-004/AC-011 — os sinalizadores são o contexto que
                          impede o gestor de ler o número como acusação. */}
                      {!a.naTurmaHoje ? (
                        <Badge variant="outline">saiu da turma</Badge>
                      ) : null}
                      {!a.alunoAtivo ? <Badge variant="outline">inativo</Badge> : null}
                      {a.vinculo !== "aprovado" ? (
                        <Badge variant="outline">{a.vinculo}</Badge>
                      ) : null}
                    </div>
                  </td>
                  <td className="py-2 pr-3 tabular-nums">
                    {a.frequenciaPct === null ? (
                      <span
                        className="text-muted-foreground"
                        title={
                          a.base === 0
                            ? "Sem registro no período"
                            : "Cobertura de chamada abaixo do piso — o percentual não se sustenta"
                        }
                      >
                        —
                      </span>
                    ) : (
                      <span>{a.frequenciaPct}%</span>
                    )}
                  </td>
                  <td className="py-2 pr-3 tabular-nums text-muted-foreground">{a.base}</td>
                  <td className="py-2 pr-3 tabular-nums text-muted-foreground">
                    {a.presente} / {a.ausente} / {a.justificado}
                  </td>
                  <td className="py-2 tabular-nums">
                    {a.faltasSeguidas === 0 ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      // A composição vem junto de propósito: "5 seguidas"
                      // e "5 seguidas, 2 justificadas" são conversas
                      // diferentes com o aluno.
                      <span>
                        {a.faltasSeguidas}
                        <span className="ml-1 text-xs text-muted-foreground">
                          ({a.faltasSeguidasComposicao.ausente} aus.
                          {a.faltasSeguidasComposicao.justificado > 0
                            ? `, ${a.faltasSeguidasComposicao.justificado} just.`
                            : ""}
                          )
                        </span>
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-xs text-muted-foreground">
            A frequência de cada aluno é calculada sobre as chamadas em que ele
            consta — não sobre todas as aulas da turma. Quem entrou depois não é
            penalizado por aulas anteriores.
          </p>
        </div>
      )}
    </div>
  );
}

function Numero({
  rotulo,
  valor,
  destaque,
}: {
  rotulo: string;
  valor: number;
  destaque?: string | null;
}) {
  return (
    <div>
      <p className="text-2xl font-semibold tabular-nums">{valor}</p>
      <p className="text-xs text-muted-foreground">
        {rotulo}
        {destaque ? <span className="ml-1">({destaque})</span> : null}
      </p>
    </div>
  );
}
