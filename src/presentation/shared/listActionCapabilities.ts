import type { ScreenListAction } from '../../domain/entities';

/**
 * Quais das ações genéricas do card cada tela fixa consegue oferecer. Prazos não tem etiquetas
 * (sem FK de tag no registry) nem clonar (o próprio detalhe não oferece), então essas ficam fora
 * da configuração em vez de aparecerem sem efeito.
 */
const SUPPORTED: Record<string, ScreenListAction[]> = {
  persons: ['copyLink', 'clone', 'manageTags', 'delete'],
  financials: ['copyLink', 'clone', 'manageTags', 'delete'],
  deadlines: ['copyLink', 'delete'],
};

/**
 * O que cada tela fixa exibia antes de a configuração existir. Serve de padrão para não regredir
 * o card de quem nunca configurou.
 */
const DEFAULTS: Record<string, ScreenListAction[]> = {
  persons: ['manageTags'],
  financials: ['delete'],
  deadlines: ['delete'],
};

export const supportedListActions = (entityKey: string): ScreenListAction[] =>
  SUPPORTED[entityKey] ?? [];

/**
 * Ações efetivas do card de uma tela fixa. Lista vazia cai no padrão: telas fixas podem já ter
 * definição gravada (por causa dos campos adicionais) com `listActions: []`, e sem essa regra o
 * card perderia as ações que sempre teve. O preço é não conseguir deixar uma tela fixa sem
 * nenhuma ação — caso raro o bastante para valer a troca.
 */
export const resolveListActions = (
  entityKey: string,
  configured: ScreenListAction[] | undefined,
): ScreenListAction[] => {
  const chosen = configured && configured.length > 0 ? configured : (DEFAULTS[entityKey] ?? []);
  const supported = supportedListActions(entityKey);
  return chosen.filter((action) => supported.includes(action));
};
