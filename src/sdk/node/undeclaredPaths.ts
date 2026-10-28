import type { MarketplacePlugin } from '../../domain/entities/MarketplacePlugin';
import type { QuerySpec } from '../../domain/schema/querySpec';
import { flattenSteps } from '../../domain/services/stepTree';
import type { CatalogScreenInput } from '../domain/catalog';
import { catalogSchemaContext, collectionOfScreen } from '../domain/catalog';
import { packageScreenInputs } from '../domain/packageScreens';
import type { UndeclaredPath } from '../domain/undeclaredPaths';
import { undeclaredQueryPaths, undeclaredReportPaths } from '../domain/undeclaredPaths';
import { INSTALLED_CATALOG_FILE, installedScreenInput, readInstalledCatalog } from './installedCatalog';
import { packageText } from './messages';
import type { WorkspaceCatalog } from './workspaceCatalog';
import { readWorkspaceCatalog } from './workspaceCatalog';

/**
 * Os caminhos de RELATÓRIO e de CONSULTA do pacote que nenhum campo declara, sobre as telas que este
 * diretório enxerga.
 *
 * A validação da plataforma aceita o caminho desconhecido — no escritório ele pode ser campo do Form
 * Design —, e por isso um `responsibleLawyerId.nomeQueNaoExiste` passava no `check` e saía como coluna
 * vazia na instalação. Aqui as telas estão em mãos, e a origem delas é a MESMA dos prefixos de evento
 * (`eventRefs.ts`): o próprio pacote, os `plugin.ts` deste diretório e o `installed-catalog.json`.
 *
 * Sempre aviso, nunca recusa — a regra de "o que não dá para ver daqui é dito, não recusado". O campo
 * pode ter sido criado depois do retrato, e a coleção sem tela visível não é conferida.
 */
export interface UndeclaredPathFinding extends UndeclaredPath {
  /** Que relatório ou automação do pacote escreve o caminho, resolvido para texto. */
  writtenBy: string;
  detail: string;
}

const QUERY_STEP = 'query';

const isQuerySpec = (value: unknown): value is QuerySpec =>
  typeof value === 'object' && value !== null && typeof (value as QuerySpec).table === 'string';

/** Os passos `query` do pacote cuja consulta é um `Literal` — a única forma que dá para ler sem executar. */
export const querySpecsOf = (pkg: MarketplacePlugin): { workflow: string; step: string; spec: QuerySpec }[] =>
  pkg.workflows.flatMap((workflow) => flattenSteps(workflow.steps).flatMap((step) => {
    const mapping = step.configuration?.query;
    if (step.stepDefinitionId !== QUERY_STEP || mapping?.kind !== 'Literal' || !isQuerySpec(mapping.value)) return [];
    return [{ workflow: workflow.name, step: step.id, spec: mapping.value }];
  }));

const hasPaths = (pkg: MarketplacePlugin): boolean =>
  (pkg.reports ?? []).length > 0 || querySpecsOf(pkg).length > 0;

/**
 * O campo que o escritório criou no Form Design sobre a tela de uma extensão escrita AQUI. O catálogo
 * descarta a tela do retrato quando o diretório tem a mesma coleção — o autor edita a versão daqui —,
 * e com ela iriam esses campos: um caminho para eles seria acusado de não declarado, e ele é.
 */
export const designedFieldsOverWorkspace = (read: WorkspaceCatalog, installed: readonly CatalogScreenInput[]): CatalogScreenInput[] => {
  const shadowed = new Set(read.installed?.shadowedCollections ?? []);
  return installed
    .filter((screen) => shadowed.has(collectionOfScreen(screen)))
    .map((screen) => ({
      ...screen,
      key: `${screen.key}#installed`,
      collection: collectionOfScreen(screen),
      fields: screen.fields.filter((field) => field.origin === 'design'),
    }))
    .filter((screen) => screen.fields.length > 0);
};

const whereDeclared = (pkg: MarketplacePlugin, screens: readonly CatalogScreenInput[], read: WorkspaceCatalog, collection: string): string => {
  const owner = screens.find((screen) => !screen.key.includes('#') && collectionOfScreen(screen) === collection);
  if (owner?.ownerPluginId === pkg.manifest.id) return 'this package';
  if (owner?.source === 'installation') {
    return `${INSTALLED_CATALOG_FILE}, taken ${read.installed?.ageDays ?? '?'} day(s) ago`;
  }
  if (owner?.ownerPluginId) return `the plugin.ts of ${owner.ownerPluginId} in this workspace`;
  return 'the screens this workspace sees';
};

export const undeclaredPathFindings = (
  pkg: MarketplacePlugin,
  read: WorkspaceCatalog,
  extraScreens: readonly CatalogScreenInput[] = [],
): UndeclaredPathFinding[] => {
  const known = read.catalog.screens;
  const listed = known.some((screen) => screen.ownerPluginId === pkg.manifest.id);
  const screens = [...known, ...(listed ? [] : packageScreenInputs(pkg, known)), ...extraScreens];
  const lookups = [
    ...read.catalog.lookups,
    ...(pkg.lookups ?? []).map((one) => ({ collection: one.collection, label: one.label })),
  ];
  const ctx = catalogSchemaContext(screens, lookups, read.catalog.tagLists);
  const describe = packageText(pkg);

  const finding = (writtenBy: string) => (found: UndeclaredPath): UndeclaredPathFinding => ({
    ...found,
    writtenBy,
    detail: `"${found.collection}" has no field "${found.segment}", according to `
      + `${whereDeclared(pkg, screens, read, found.collection)}. The platform runs it anyway — it could be a `
      + 'field an office created in the Form Design — and the column comes out empty wherever no such field '
      + 'exists. If it is not a field you expect every office to create, it is a typo.',
  });

  return [
    ...(pkg.reports ?? []).flatMap((report) =>
      undeclaredReportPaths(report.spec, ctx).map(finding(`report "${describe(report.title)}"`))),
    ...querySpecsOf(pkg).flatMap(({ workflow, spec }) =>
      undeclaredQueryPaths(spec, ctx).map(finding(`query step of workflow "${describe(workflow)}"`))),
  ];
};

/**
 * O relatório, a partir do diretório. O catálogo só é lido quando há relatório ou consulta: conferir um
 * pacote sem nenhum dos dois não paga o preço de compilar todos os `plugin.ts` do diretório.
 */
export const undeclaredPathReport = (pkg: MarketplacePlugin, root: string): UndeclaredPathFinding[] => {
  if (!hasPaths(pkg)) return [];
  const read = readWorkspaceCatalog(root);
  const installed = (readInstalledCatalog(root).snapshot?.screens ?? []).map(installedScreenInput);
  return undeclaredPathFindings(pkg, read, designedFieldsOverWorkspace(read, installed));
};
