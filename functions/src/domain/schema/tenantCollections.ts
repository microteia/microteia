// ═══════════════════════════════════════════════════════════════════════════
// ⚠️  ARQUIVO GERADO POR scripts/sync-schemas.cjs — NÃO EDITE.
// Fonte única: src/domain/schema/tenantCollections.ts
// Para alterar, edite a fonte e rode: npm run sync-schemas
// ═══════════════════════════════════════════════════════════════════════════

import type { ScreenDefinition } from '../entities/entitySchemas';
import type { PermissionResource } from './access/resolvePermissions';
import type { SchemaLookup, SchemaTagList } from './screenEntity';
import { derivesReadAllPermission } from './memberVisibility';
import {
  BUILTIN_LOOKUPS,
  BUILTIN_TAG_LISTS,
  RESERVED_COLLECTIONS,
  isCollectionAnchor,
} from './screenEntity';

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

export type ScreenPresentationSource = ScreenCollectionSource & Pick<ScreenDefinition, 'origin'>;

/**
 * As telas que APRESENTAM uma coleção: todas, menos a âncora das rules (`isCollectionAnchor`) de uma
 * coleção que outra tela já descreve. É o que uma lista de "telas do escritório" mostra.
 *
 * A âncora órfã — a extensão que descrevia a coleção foi desinstalada, e os registros ficaram —
 * continua: ela é a única coisa que ainda dá nome à coleção, e sem ela a permissão de ler o que
 * ficou sumiria do catálogo.
 */
export const presentedScreens = <T extends ScreenPresentationSource>(screens: readonly T[]): T[] => {
  const described = new Set(screens.filter(isBoundScreen).map(screenDataCollection));
  return screens.filter((screen) => !(isCollectionAnchor(screen) && described.has(screen.id)));
};

/** A tela como as coleções derivadas a enxergam: só o que declara nomes de outras coleções. */
export interface ScreenCollectionDeclaration {
  titleSingular: string;
  titlePlural?: string;
  tagCollection?: string | null;
  fields: { label: string; lookupCollection?: string | null }[];
}

export interface DerivedCollection {
  collection: string;
  /** REFERÊNCIA de mensagem, ou o rótulo que o escritório digitou; `labelParams` interpola. */
  label: string;
  labelParams?: Record<string, string>;
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
export const screenTagCollections = (screens: readonly ScreenCollectionDeclaration[]): DerivedCollection[] =>
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
export const screenLookupCollections = (screens: readonly ScreenCollectionDeclaration[]): DerivedCollection[] =>
  dedupe(
    screens.flatMap((screen) => screen.fields
      .filter((field) => !!field.lookupCollection?.trim())
      .map((field) => ({
        collection: (field.lookupCollection as string).trim(),
        label: `${screen.titleSingular}: ${field.label}`,
      }))),
  );

const byCollection = <T extends SchemaLookup>(items: readonly T[]): T[] => {
  const merged = new Map<string, T>();
  for (const item of items) merged.set(item.collection, item);
  return [...merged.values()];
};

/**
 * TODAS as listas de opções do escritório: as do núcleo, as que um campo de tela referencia e as
 * declaradas em `lookupDefinitions`.
 *
 * O declarado vem por último e por isso vence o rótulo: é o nome que o escritório deu à lista. É a
 * mesma conta no navegador (`LookupStore`) e no servidor (`PermissionCatalogCache`) — enquanto o
 * servidor lia só `lookupDefinitions`, a lista que um campo de tela referenciava aparecia no seletor
 * de permissões e era recusada como desconhecida ao emitir o acesso.
 */
export const tenantLookupCollections = (
  screens: readonly ScreenCollectionDeclaration[],
  declared: readonly SchemaLookup[],
): SchemaLookup[] => byCollection([...BUILTIN_LOOKUPS, ...screenLookupCollections(screens), ...declared]);

/**
 * TODOS os conjuntos de etiquetas do escritório. Aqui o DERIVADO vence o persistido, ao contrário
 * das listas: o persistido é uma foto de um instante, num idioma, e o derivado é uma referência com o
 * nome da tela em `labelParams` — traduz e acompanha o nome. O persistido segue valendo para o
 * conjunto a que nenhuma tela aponta, que é o caso da declaração que sobrevive à exclusão da tela.
 */
export const tenantTagCollections = (
  screens: readonly ScreenCollectionDeclaration[],
  declared: readonly SchemaTagList[],
): SchemaTagList[] => byCollection([...declared, ...BUILTIN_TAG_LISTS, ...screenTagCollections(screens)]);

/**
 * As listas de opções e os conjuntos de etiquetas como RECURSOS do catálogo de permissões.
 *
 * Existe como ponto único por duas razões que já custaram caro separadas:
 *
 * 1. **O rótulo viaja com os parâmetros dele.** `SchemaLookup` guarda `label` e `labelParams`, e o
 *    mapeamento que ficava no store levava só o primeiro — `@core.data/lookup.qualified` chegava à
 *    tela de Perfis de acesso como o próprio template, sem nada para interpolar.
 * 2. **Coleção RESERVADA não deriva CRUD.** O `firestore.rules` só monta `<coleção>.create` no
 *    curinga, e o curinga exige `!isReservedCollection(name)`: uma reservada tem regra própria, com
 *    permissão própria — `documentTypes` é guardada por `document-types.manage`. Derivar as quatro
 *    para ela dava um grupo inteiro de permissões que nenhuma regra lê, ao lado do grupo verdadeiro.
 */
export const collectionPermissionResources = (
  ...groups: readonly (readonly SchemaLookup[])[]
): PermissionResource[] =>
  groups
    .flat()
    .filter((collection) => !RESERVED_COLLECTIONS.has(collection.collection))
    .map((collection) => ({
      id: collection.collection,
      name: collection.label,
      ...(collection.labelParams ? { nameParams: collection.labelParams } : {}),
      deriveCrud: true,
    }));

export type CatalogScreenSource = ScreenPresentationSource
  & ScreenCollectionDeclaration
  & Pick<ScreenDefinition, 'ownerPluginId' | 'memberVisibility'>;

/**
 * As coleções cuja leitura é por registro sem supervisão nomeada — as que ganham `<coleção>.read-all`.
 * A declaração é a do documento `screenDefinitions/<coleção>`, o que a regra lê: numa tela com
 * `dataCollection`, é a cópia na âncora, nunca a tela que a apresenta.
 */
const readAllCollections = (screens: readonly CatalogScreenSource[]): Set<string> =>
  new Set(
    screens
      .filter((screen) => !isBoundScreen(screen) && derivesReadAllPermission(screen.memberVisibility))
      .map((screen) => screen.id),
  );

/**
 * Os recursos do catálogo de permissões que as COLEÇÕES do escritório rendem: listas de opções,
 * conjuntos de etiquetas e telas, cada uma com o CRUD derivado.
 *
 * É a única conta, e as duas pontas a chamam — o `AuthorizationStore`, que alimenta Perfis, a aba de
 * Agentes de IA e o consentimento de OAuth, e o `PermissionCatalogCache`, que confere a emissão do
 * acesso e materializa o conjunto que as Security Rules leem. Duas contas parecidas foram o defeito:
 * a tela oferecia uma permissão que o servidor não conhecia, e o acesso era recusado inteiro.
 */
export const tenantCollectionPermissionResources = (
  screens: readonly CatalogScreenSource[],
  lookups: readonly SchemaLookup[],
  tagLists: readonly SchemaTagList[],
): PermissionResource[] => {
  const readAll = readAllCollections(screens);
  return [
    ...collectionPermissionResources(lookups, tagLists),
    ...presentedScreens(screens).map((screen) => ({
      id: screenDataCollection(screen),
      name: screen.titlePlural || screen.titleSingular || screen.id,
      deriveCrud: true,
      ...(readAll.has(screenDataCollection(screen)) ? { deriveReadAll: true } : {}),
      ...(screen.ownerPluginId ? { source: screen.ownerPluginId } : {}),
    })),
  ];
};
