import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * SPEC-053/D1, D2 — **a regra de redação no painel, lida do código-fonte.**
 *
 * Os três textos do Admin que a D2 reescreve (a opção "Sem professor" da
 * reserva, o aviso dos cadastros pendentes e o do link público) não têm teste
 * de tela; esta prova os cobre. Mesmo molde da prova homônima do Cliente.
 *
 * **Não é gate editorial (LIM-053a):** guarda as expressões que a SPEC-053
 * removeu, não o bom senso de quem escrever texto novo.
 */

const SRC = path.resolve(import.meta.dirname, "..");

/**
 * **Comentário não é texto de tela.** A ADR-021 mantém "quadra" no código — e um
 * comentário que explica que `professorId` vazio é "reserva de quadra" está
 * certo. A primeira versão desta prova varria comentários e acusou quatro
 * falsos positivos no Admin. O `//` só conta como comentário fora de URL
 * (`https://`).
 */
function semComentarios(codigo: string): string {
  return codigo
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

function arquivosDeProducao(dir: string): string[] {
  return readdirSync(dir).flatMap((nome) => {
    const caminho = path.join(dir, nome);
    if (statSync(caminho).isDirectory()) return arquivosDeProducao(caminho);
    if (!/\.(ts|tsx)$/.test(nome)) return [];
    if (/\.test\.(ts|tsx)$/.test(nome) || nome === "api-types.ts") return [];
    return [caminho];
  });
}

const lerCompacto = (rel: string) =>
  readFileSync(path.join(SRC, rel), "utf8").replace(/\s+/g, " ");

const PROIBIDAS = [
  /reservar\s+quadra/i,
  /reservam\s+quadra/i,
  /reservas?\s+de\s+quadra/i,
];

describe("SPEC-053 — a regra de redação no painel", () => {
  it("AC-001: nenhum arquivo de produção contém as expressões da categoria B", () => {
    const achados = arquivosDeProducao(SRC).flatMap((arquivo) => {
      const conteudo = semComentarios(readFileSync(arquivo, "utf8"));
      return PROIBIDAS.filter((re) => re.test(conteudo)).map(
        (re) => `${path.relative(SRC, arquivo)} ~ ${re}`,
      );
    });
    expect(achados).toEqual([]);
  });

  it("D2: os três textos novos", () => {
    expect(lerCompacto("components/court-manager.tsx")).toMatch(
      /<SelectItem value=\{SEM_PROFESSOR\}> Sem professor <\/SelectItem>/,
    );
    expect(lerCompacto("components/cadastros-pendentes.tsx")).toContain(
      "Até aprovar, elas não fazem reservas nem entram em turma.",
    );
    expect(lerCompacto("components/link-cadastro-card.tsx")).toContain(
      "só passa a fazer reservas ou entrar em turma depois que você aprovar.",
    );
  });
});
