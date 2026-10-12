import type { MarketplacePlugin, ScreenModuleTemplate, ScreenPatchTemplate } from '../../domain/entities/MarketplacePlugin';
import type { SchemaContext } from '../../domain/schema/pathResolver';
import type { CatalogScreenInput } from './catalog';
import { catalogSchemaContext, collectionOfScreen } from './catalog';

/**
 * AS TELAS DE UM PACOTE, na forma do catálogo — e o esquema de um conjunto de pacotes.
 *
 * Morava dentro de `workspaceCatalog.ts`, que lê o disco. Saiu para cá porque um TESTE de extensão
 * precisa da mesma passagem sem diretório nenhum: o Painel montava o esquema das irmãs à mão — os
 * campos de cada tela, os `screenPatches` por coleção e por `sourceId`, um `as never` no fim — e uma
 * segunda cópia dessa passagem divergiria da do `check` na primeira regra nova.
 *
 * O tipo aceito é o estrutural mínimo, e não `MarketplacePlugin`: o `plugin.ts` exporta um
 * `AuthoredPlugin`, que difere no que aqui não interessa (views, startup).
 */
export type ScreenSourcePackage = Pick<MarketplacePlugin, 'screens' | 'screenPatches' | 'lookups' | 'tagLists'>
  & { manifest: { id: string } };

const screenFrom = (template: ScreenModuleTemplate, pluginId: string): CatalogScreenInput => ({
  key: template.key,
  ...(template.dataCollection === undefined ? {} : { collection: template.dataCollection }),
  // O id universal que o pacote já declara. É a segunda precedência da identidade da tela no plano, e
  // sem carregá-lo daqui o plano derivaria um valor novo para uma tela que já tem um — que é o defeito
  // que a identidade existe para não cometer.
  ...(template.sourceId === undefined ? {} : { sourceId: template.sourceId }),
  titleSingular: template.titleSingular,
  titlePlural: template.titlePlural,
  titleFieldKey: template.titleFieldKey,
  fields: template.fields.map((field) => ({ ...field, origin: 'plugin' as const, ownerPluginId: pluginId })),
  ...(template.parentEntity === undefined ? {} : { parentEntity: template.parentEntity }),
  ...(template.parentFieldKey === undefined ? {} : { parentFieldKey: template.parentFieldKey }),
  ...(template.parentRelation === undefined ? {} : { parentRelation: template.parentRelation }),
  ...(template.tagCollection === undefined ? {} : { tagCollection: template.tagCollection }),
  ...(template.eventPrefix === undefined ? {} : { eventPrefix: template.eventPrefix }),
  ownerPluginId: pluginId,
});

/**
 * Um complemento entra como uma SEGUNDA tela sobre a mesma coleção, com chave própria. É assim que
 * `createSchemaContext` já trata o caso, e é o que faz os campos somarem sem que o complemento
 * reivindique o nome da entidade: quem dá rótulo e campo-título continua sendo a tela dona.
 */
const patchScreen = (pkg: ScreenSourcePackage, patch: ScreenPatchTemplate, index: number, collection: string): CatalogScreenInput => ({
  key: `${pkg.manifest.id}#patch${index}`,
  collection,
  titleSingular: collection,
  titleFieldKey: '',
  fields: patch.fields.map((field) => ({ ...field, origin: 'plugin' as const, ownerPluginId: pkg.manifest.id })),
  ownerPluginId: pkg.manifest.id,
});

const isPatchTo = (patch: ScreenPatchTemplate, kind: 'collection' | 'sourceId'): boolean =>
  (patch.targetKind ?? 'collection') === kind;

/**
 * `targetKind: 'sourceId'` é o complemento à tela de OUTRA extensão, cuja chave instalada varia por
 * escritório. O `sourceId` é universal, e por isso ele se resolve contra as telas já conhecidas — o
 * que só pode acontecer DEPOIS de todas entrarem: a dona pode vir depois de quem a complementa. O que
 * não se acha fica de fora; o que se acha deixava de existir, e o campo acrescentado parecia não
 * declarado por ninguém.
 */
export const sourceIdPatchesFrom = (pkg: ScreenSourcePackage, screens: readonly CatalogScreenInput[]): CatalogScreenInput[] =>
  (pkg.screenPatches ?? []).flatMap((patch, index) => {
    if (!isPatchTo(patch, 'sourceId')) return [];
    const target = screens.find((screen) => !screen.key.includes('#') && (screen.sourceId ?? screen.key) === patch.target);
    return target === undefined ? [] : [patchScreen(pkg, patch, index, collectionOfScreen(target))];
  });

export interface PackageScreenOptions {
  /**
   * Resolver já os complementos por `sourceId`. Quem junta vários pacotes desliga e resolve no fim,
   * com todas as telas em mãos — ver `sourceIdPatchesFrom`.
   */
  sourceIdPatches?: boolean;
}

/** `around` são as telas já conhecidas, contra as quais o complemento por `sourceId` se resolve. */
export const packageScreenInputs = (
  pkg: ScreenSourcePackage,
  around: readonly CatalogScreenInput[] = [],
  options: PackageScreenOptions = {},
): CatalogScreenInput[] => {
  const own = [
    ...(pkg.screens ?? []).map((template) => screenFrom(template, pkg.manifest.id)),
    ...(pkg.screenPatches ?? []).flatMap((patch, index) =>
      (isPatchTo(patch, 'collection') ? [patchScreen(pkg, patch, index, patch.target)] : [])),
  ];
  return options.sourceIdPatches === false ? own : [...own, ...sourceIdPatchesFrom(pkg, [...own, ...around])];
};

/**
 * O esquema que um conjunto de pacotes declara — as telas, os complementos de um à tela do outro e as
 * listas —, para um teste de extensão validar relatório e consulta contra as telas IRMÃS.
 */
export const packagesSchemaContext = (plugins: readonly ScreenSourcePackage[]): SchemaContext => {
  const screens = plugins.flatMap((pkg) => packageScreenInputs(pkg, [], { sourceIdPatches: false }));
  const patched = [...screens, ...plugins.flatMap((pkg) => sourceIdPatchesFrom(pkg, screens))];
  const listsOf = (key: 'lookups' | 'tagLists') =>
    plugins.flatMap((pkg) => (pkg[key] ?? []).map((one) => ({ collection: one.collection, label: one.label })));
  return catalogSchemaContext(patched, listsOf('lookups'), listsOf('tagLists'));
};
