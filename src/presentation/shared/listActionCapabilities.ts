import type { ScreenListAction } from '../../domain/entities';

/**
 * Quais das ações genéricas do card cada tela FIXA consegue oferecer, e o que ela exibia antes de a
 * configuração existir.
 *
 * Os dois mapas estão VAZIOS desde que Prazo — a última entidade do kernel a ter tela de registro —
 * saiu para uma extensão. Uma tela de extensão declara as próprias ações (`listActions`) e não passa
 * por aqui; o mecanismo continua no lugar para o dia em que o kernel voltar a ter uma tela fixa,
 * porque o que ele protege é o card de quem nunca configurou nada.
 */
const SUPPORTED: Record<string, ScreenListAction[]> = {};

const DEFAULTS: Record<string, ScreenListAction[]> = {};

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
