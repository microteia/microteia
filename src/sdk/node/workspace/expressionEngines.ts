/**
 * As funções com o MESMO nome e resultado diferente na tela e na automação. São dois motores (o de campo
 * e o do Workflow), e unificá-los mudaria o resultado de expressões que já rodam nos escritórios — então
 * a diferença é dita, e o guia de autoria lê esta mesma lista.
 */
export const EXPRESSION_ENGINE_DIFFERENCES: Record<string, { screen: string; automation: string }> = {
  coalesce: {
    screen: 'skips null, undefined, empty text and an empty list',
    automation: 'skips only null and undefined — an empty text is returned',
  },
  isEmpty: {
    screen: 'an empty object is NOT empty',
    automation: 'an empty object IS empty, and so is an invalid date',
  },
  formatMoney: {
    screen: 'defaults to the language of whoever is looking; the second argument is any language tag',
    automation: 'defaults to pt-br (R$); the second argument is pt-br, en-us, en-gb or es-es, anything else falls back to pt-br',
  },
};
