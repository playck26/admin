import type { components } from "@/lib/api-types";

type Origens = components["schemas"]["OrigensDaCoberturaResponseDto"];

/**
 * SPEC-057/TASK-001/D6 — **de onde veio cada aula que conta na frequência.**
 *
 * Com a presença automática, "chamada completa" deixou de querer dizer
 * "alguém olhou". O percentual continua o mesmo cálculo; o que este bloco
 * acrescenta é de onde ele vem — e aparece **mesmo com o percentual
 * suprimido**, porque é justamente ali que o gestor precisa saber por quê.
 *
 * `compacto` é a linha única do cartão de evasão; o padrão é a lista do
 * relatório da turma e do aluno.
 */

/**
 * SPEC-076/D6 — **o que "falta" quer dizer desde a SPEC-076**, numa frase
 * só, usada pelas quatro telas que mostram falta ou frequência.
 *
 * A frase de antes mandava o gestor esperar uma correção do professor que não
 * existe mais: ninguém lança presença à mão (decisões 1 e 9). O fechamento
 * automático grava `ausente` para quem avisou falta pelo app, e `presente`
 * para os demais (LIM-076b).
 */
export const FALTA_E_AVISO =
  "Falta, aqui, é aviso de falta pelo app: no fechamento automático, quem avisou fica como Faltou e os demais como presentes. Ninguém corrige presença à mão.";

const ITENS: { chave: keyof Origens; rotulo: string }[] = [
  { chave: "automaticas", rotulo: "automáticas" },
  { chave: "ratificadas", rotulo: "automáticas revisadas" },
  { chave: "humanas", rotulo: "lançadas por pessoa" },
  { chave: "pendentesLegadas", rotulo: "sem registro, anteriores à automação" },
  { chave: "pendentesAtuais", rotulo: "aguardando fechamento" },
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
      <p>{FALTA_E_AVISO}</p>
    </div>
  );
}
