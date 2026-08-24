"use client";

import { useState } from "react";
import { FrequenciaTurma } from "@/components/frequencia-turma";
import { PresencasTurma } from "@/components/presencas-turma";

/**
 * SPEC-015/TASK-004 — presença e frequência são duas leituras do MESMO
 * dado, e por isso viram abas uma da outra em vez de duas seções empilhadas.
 *
 * A ordem importa: **"Presenças" fica primeiro** porque é o registro, o
 * fato bruto; "Frequência" é a interpretação dele. Um gestor que desconfia
 * de um percentual precisa de um clique para ver as linhas que o
 * produziram — se a interpretação viesse primeiro, a tela estaria pedindo
 * confiança antes de mostrar a prova.
 */
const ABAS = [
  { id: "presencas", rotulo: "Presenças" },
  { id: "frequencia", rotulo: "Frequência" },
] as const;

type Aba = (typeof ABAS)[number]["id"];

export function TurmaChamadaAbas({ turmaId }: { turmaId: string }) {
  const [aba, setAba] = useState<Aba>("presencas");

  // Cada aba é montada na primeira vez que abre e **fica montada** daí em
  // diante, escondida por `hidden`.
  //
  // Desmontar parecia mais econômico e custava caro: o `FrequenciaTurma`
  // guarda a janela escolhida, então ir para "Presenças" e voltar zerava
  // 90 dias de volta para 30 — a tela trocava os números sob o mesmo
  // rótulo, sem ninguém pedir. Manter montado também conserta o
  // `aria-controls`, que antes apontava para um painel que não existia no
  // DOM quando a aba estava inativa.
  //
  // O que a montagem preguiçosa preserva é o que importava: a frequência
  // são 2 queries por chamada, e quem veio ver a lista de presença não
  // paga por elas.
  // `useState`, não `useRef`: o conjunto é LIDO durante o render para
  // decidir o que montar, e ref lida no render é justamente o que a regra
  // `react-hooks/refs` proíbe — o valor pode mudar sem disparar render e a
  // tela fica atrás do que ele diz.
  const [visitadas, setVisitadas] = useState<Set<Aba>>(
    () => new Set<Aba>(["presencas"]),
  );

  const abrir = (id: Aba) => {
    setAba(id);
    if (!visitadas.has(id)) {
      setVisitadas((antes) => new Set(antes).add(id));
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div
        role="tablist"
        aria-label="Chamada da turma"
        className="flex gap-1 border-b border-border"
      >
        {ABAS.map((a) => {
          const ativa = aba === a.id;
          return (
            <button
              key={a.id}
              type="button"
              role="tab"
              id={`aba-${a.id}`}
              aria-selected={ativa}
              aria-controls={`painel-${a.id}`}
              // Roving tabindex: o Tab entra na aba ativa, e as setas — que
              // o navegador já resolve dentro do `tablist` — passeiam entre
              // elas. Sem isto, o teclado para em cada aba antes de chegar
              // no conteúdo.
              tabIndex={ativa ? 0 : -1}
              onClick={() => abrir(a.id)}
              className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
                ativa
                  ? "border-primary text-primary"
                  : "border-transparent text-[var(--color-on-surface-variant)] hover:text-[var(--color-on-surface)]"
              }`}
            >
              {a.rotulo}
            </button>
          );
        })}
      </div>

      {ABAS.map((a) => (
        <div
          key={a.id}
          role="tabpanel"
          id={`painel-${a.id}`}
          aria-labelledby={`aba-${a.id}`}
          hidden={aba !== a.id}
          className="min-h-[8rem]"
        >
          {visitadas.has(a.id) ? (
            a.id === "presencas" ? (
              <PresencasTurma turmaId={turmaId} />
            ) : (
              <FrequenciaTurma turmaId={turmaId} />
            )
          ) : null}
        </div>
      ))}
    </div>
  );
}
