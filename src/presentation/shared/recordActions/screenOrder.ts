/**
 * As ações de registro que a tela habilitou, na ORDEM em que ela as lista em `listActions`. A ordem
 * da contribuição só desempata o mesmo slot (excluir e desvincular), em que no máximo uma aparece.
 */
export const inScreenOrder = <T extends { slot: string }>(
  actions: readonly T[],
  listActions: readonly string[],
): T[] => {
  const position = new Map(listActions.map((slot, index) => [slot, index]));
  return actions
    .filter((action) => position.has(action.slot))
    .sort((a, b) => (position.get(a.slot) ?? 0) - (position.get(b.slot) ?? 0));
};
