import type { ScreenDefinition } from '../entities';
import { collectionPermissionId } from '../schema/access/permission';

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

/**
 * A permissão que ver esta tela EXIGE — a de ler a coleção dela, não a chave da tela.
 *
 * O menu e o ⌘K precisam da mesma frase que o catálogo derivou em `buildPermissionCatalog` e que o
 * `firestore.rules` cobra: uma tela vinculada (`dataCollection`) é vista por quem lê a coleção de
 * destino, e não por quem lê uma coleção com o nome da aba. Sem este ponto único, um menu podia
 * perguntar por uma permissão que o catálogo nunca emitiu — e ficar escondido para todo mundo.
 */
export const screenReadPermission = (screen: ScreenCollectionSource): string =>
  collectionPermissionId(screenDataCollection(screen), 'read');

export type ScreenParentSource = Pick<ScreenDefinition, 'parentEntity' | 'parentRelation'>;

/**
 * A tela é FILHA de outra — os registros dela pertencem ao pai. É o que a tira do menu lateral e da
 * busca ⌘K, esconde o campo de vínculo do formulário e faz o registro voltar para o pai ao salvar.
 *
 * Declarar `parentEntity` sozinho já não basta: com `parentRelation: 'related'` o pai apenas MOSTRA
 * os registros que apontam para ele, e a tela continua sendo uma entidade de topo. O ponto único
 * existe para que as quatro decisões acima nunca divirjam entre si.
 */
export const isOwnedByParentScreen = (screen: ScreenParentSource): boolean =>
  !!screen.parentEntity && (screen.parentRelation ?? 'owned') === 'owned';

/** A tela como as coleções derivadas a enxergam: só o que declara nomes de outras coleções. */
export interface ScreenCollectionDeclaration {
  titleSingular: string;
  titlePlural?: string;
  tagCollection?: string | null;
  fields: { label: string; lookupCollection?: string | null }[];
}

export interface DerivedCollection {
  collection: string;
  label: string;
}

const dedupe = (items: DerivedCollection[]): DerivedCollection[] => {
  const byCollection = new Map<string, DerivedCollection>();
  for (const item of items) byCollection.set(item.collection, item);
  return [...byCollection.values()];
};

/**
 * As coleções de ETIQUETAS que as telas do escritório declaram.
 *
 * Existe porque a declaração da TELA basta: a coleção existe porque uma tela aponta para ela, tenha
 * ou não documento em `tagDefinitions`. Sem isso, uma entidade que saiu do kernel e passou a ser
 * declarada por extensão ficaria com as etiquetas invisíveis — elas continuam gravadas, mas ninguém
 * as assina.
 */
export const screenTagCollections = (screens: ScreenCollectionDeclaration[]): DerivedCollection[] =>
  dedupe(
    screens
      .filter((screen) => !!screen.tagCollection?.trim())
      .map((screen) => ({
        collection: (screen.tagCollection as string).trim(),
        label: '@core.records/tag-list.of',
        labelParams: { name: screen.titlePlural || screen.titleSingular },
      })),
  );

/** Mesmo princípio para as LISTAS DE OPÇÕES que os campos das telas referenciam. */
export const screenLookupCollections = (screens: ScreenCollectionDeclaration[]): DerivedCollection[] =>
  dedupe(
    screens.flatMap((screen) => screen.fields
      .filter((field) => !!field.lookupCollection?.trim())
      .map((field) => ({
        collection: (field.lookupCollection as string).trim(),
        label: `${screen.titleSingular}: ${field.label}`,
      }))),
  );
