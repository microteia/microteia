import type { ScreenDefinition } from '../entities';

export type ScreenCollectionSource = Pick<ScreenDefinition, 'id' | 'dataCollection'>;

/**
 * A coleção onde os registros de uma tela vivem — o ponto único que traduz "tela" em "onde estão os
 * dados". Para quase toda tela é a própria chave; quando `dataCollection` está presente, a coleção
 * deixa de ser a identidade da tela e vira uma propriedade dela.
 *
 * Toda leitura, gravação, exclusão, etiqueta, anotação e documento passa por aqui — a chave da tela
 * segue endereçando apenas a UI (abas, deep link, filtros salvos).
 */
export const screenDataCollection = (screen: ScreenCollectionSource): string =>
  screen.dataCollection?.trim() || screen.id;

/**
 * A tela opera uma coleção que não leva o seu nome. Ela continua declarando o esquema dessa coleção
 * — o que muda é que a declaração se soma à de quem mais a descreva (ver `createSchemaContext`), e
 * que os registros já existem, vindos de outra tela ou de uma entidade do kernel.
 */
export const isBoundScreen = (screen: ScreenCollectionSource): boolean =>
  screenDataCollection(screen) !== screen.id;
