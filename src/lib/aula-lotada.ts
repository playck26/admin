/**
 * ADR-027 (achado A-04 da validação da SPEC-075) — **a tela do gestor não
 * anuncia a vaga que a alocação recusa.** O Back traz, na turma,
 * `proximaAulaLotada`: a primeira aula em que um aluno novo não caberia,
 * contando as reposições marcadas. Aqui fica só o TEXTO; quem decide continua
 * sendo o servidor — a tela não bloqueia a alocação, porque quem já é visitante
 * daquela aula ainda cabe, e isso só a alocação sabe.
 *
 * A data vem como `YYYY-MM-DD` (dia do clube). Formatada por fatia, e não por
 * `new Date(...)`: `new Date("2026-10-03")` é meia-noite UTC, que no fuso do
 * clube ainda é o dia 2.
 */
export function diaEMes(dataIso: string): string {
  return `${dataIso.slice(8, 10)}/${dataIso.slice(5, 7)}`;
}

export function avisoDeAulaLotada(dataIso: string): string {
  return `A aula de ${diaEMes(dataIso)} já está lotada, contando as reposições marcadas: um aluno novo só cabe depois dela.`;
}
