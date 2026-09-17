import type { components } from "@/lib/api-types";

type Origens = components["schemas"]["OrigensDaCoberturaResponseDto"];

/**
 * SPEC-057/TASK-001/D6 — **de onde veio cada aula que conta na frequência.**
 *
 * Com a presença automática, "chamada completa" deixou de querer dizer
 * "alguém olhou": o fechamento automático presume que todo mundo veio. O
 * percentual continua o mesmo cálculo; o que este bloco acrescenta é quanto
 * dele é presunção — e aparece **mesmo com o percentual suprimido**, porque é
 * justamente ali que o gestor precisa saber por quê.
 *
 * `compacto` é a linha única do cartão de evasão; o padrão é a lista do
 * relatório da turma e do aluno.
 */
export const EXPLICACAO_DA_PRESUNCAO =
  "Presenças automáticas são presumidas; faltas devem ser corrigidas pelo professor.";

const ITENS: { chave: keyof Origens; rotulo: string }[] = [
  { chave: "automaticas", rotulo: "automáticas" },
  { chave: "ratificadas", rotulo: "automáticas revisadas" },
  { chave: "humanas", rotulo: "lançadas por pessoa" },
  { chave: "pendentesLegadas", rotulo: "pendentes anteriores à automação" },
  { chave: "pendentesAtuais", rotulo: "pendentes" },
];

export function OrigensDaCobertura({
  origens,
  compacto = false,
}: {
  origens: Origens;
  compacto?: boolean;
}) {
  const presentes = ITENS.filter((i) => origens[i.chave] > 0);
  if (presentes.length === 0) return null;
  const texto = presentes
    .map((i) => `${origens[i.chave]} ${i.rotulo}`)
    .join(" · ");

  if (compacto) {
    return (
      <p className="text-xs text-[var(--color-on-surface-variant)]">
        Aulas: {texto}
      </p>
    );
  }
  return (
    <div className="mt-3 space-y-1 text-xs text-muted-foreground">
      <p>
        <span className="font-medium text-foreground">Origem das aulas:</span>{" "}
        {texto}
      </p>
      {origens.automaticas + origens.ratificadas > 0 ? (
        <p>{EXPLICACAO_DA_PRESUNCAO}</p>
      ) : null}
    </div>
  );
}
