import "@testing-library/jest-dom/vitest";

/**
 * SPEC-039 — **o jsdom não implementa `scrollIntoView`, e o `Select` do Radix
 * precisa dele.**
 *
 * Sem este stub, qualquer teste que ABRA um `Select` morre com
 * `TypeError: candidate?.scrollIntoView is not a function` — e o erro não diz
 * nada sobre Radix nem sobre jsdom. Foi o que aconteceu ao testar o seletor de
 * professor da aula particular: cinco casos vermelhos por uma função ausente,
 * não por comportamento errado.
 *
 * Mora aqui e não no arquivo de teste porque é limitação do AMBIENTE, não
 * daquele componente: o próximo `Select` testado encontraria o mesmo muro.
 */
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = function scrollIntoView() {
    /* jsdom não rola nada; o que importa é a função existir. */
  };
}
