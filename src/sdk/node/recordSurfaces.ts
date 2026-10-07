import type { MarketplacePlugin } from '../../domain/entities/MarketplacePlugin';
import { recordSurfaceSourceId } from '../../domain/schema/ui/uiExtensionPoints';
import { collectionOfScreen } from '../domain/catalog';
import { INSTALLED_CATALOG_FILE } from './installedCatalog';
import type { WorkspaceCatalog } from './workspaceCatalog';
import { readWorkspaceCatalog } from './workspaceCatalog';

/**
 * As TELAS a que o pacote pendura abas (`ui.tab` em `record:<sourceId>`), e se este diretório enxerga
 * cada uma.
 *
 * Nunca é recusa. A tela pode ser de outra extensão, e um `sourceId` que não se acha aqui pode existir
 * no escritório de destino — a regra de "o que não dá para ver daqui é dito, não recusado". O que
 * se recusa é só a superfície sem `sourceId`, e isso é do portão do pacote (`packageSurfaceIssues`).
 *
 * Três lugares respondem, e só eles: o próprio pacote, uma extensão escrita neste diretório que o
 * pacote declara em `dependencies`, e o retrato da instalação. Uma irmã deste diretório que NÃO está
 * em `dependencies` é dita à parte: a aba só aparece onde ela estiver instalada, e nada garante isso.
 */
export type RecordSurfaceStatus = 'ok' | 'not-a-dependency' | 'not-found';

export interface RecordSurfaceFinding {
  sourceId: string;
  /** Os ids das contribuições que apontam para esta tela. */
  contributions: string[];
  status: RecordSurfaceStatus;
  detail: string;
}

const referencedSourceIds = (pkg: MarketplacePlugin): Map<string, string[]> => {
  const bySourceId = new Map<string, string[]>();
  for (const contribution of pkg.manifest.contributes ?? []) {
    const surface = contribution?.metadata?.surface;
    const sourceId = typeof surface === 'string' ? recordSurfaceSourceId(surface) : null;
    if (!sourceId) continue;
    bySourceId.set(sourceId, [...(bySourceId.get(sourceId) ?? []), String(contribution.id)]);
  }
  return bySourceId;
};

export const recordSurfaceFindings = (pkg: MarketplacePlugin, read: WorkspaceCatalog): RecordSurfaceFinding[] => {
  const own = new Set((pkg.screens ?? []).map((screen) => screen.sourceId ?? screen.key));
  const dependencies = new Set(Object.keys(pkg.manifest.dependencies ?? {}));
  const authored = new Set(read.authored.map((one) => one.pluginId));
  const fromInstallation = new Set(read.installed?.addedCollections ?? []);

  return Array.from(referencedSourceIds(pkg), ([sourceId, contributions]): RecordSurfaceFinding => {
    const head = { sourceId, contributions };
    if (own.has(sourceId)) return { ...head, status: 'ok', detail: 'declared by this package.' };

    const screens = read.catalog.screens.filter((screen) => (screen.sourceId ?? screen.key) === sourceId);
    const installed = screens.find((screen) => fromInstallation.has(collectionOfScreen(screen)));
    if (installed !== undefined) {
      return {
        ...head,
        status: 'ok',
        detail: `installed in ${read.installed?.tenantName}, according to ${INSTALLED_CATALOG_FILE}.`,
      };
    }

    const owner = screens.map((screen) => screen.ownerPluginId ?? '').find((id) => authored.has(id));
    if (owner !== undefined && dependencies.has(owner)) {
      return { ...head, status: 'ok', detail: `declared by ${owner}, a dependency authored in this workspace.` };
    }
    if (owner !== undefined) {
      return {
        ...head,
        status: 'not-a-dependency',
        detail: `declared by ${owner} in this workspace, which is not in manifest.dependencies. The tab only `
          + `appears where ${owner} is installed - declare the dependency so the installation can say so.`,
      };
    }

    return {
      ...head,
      status: 'not-found',
      detail: 'no screen with this sourceId in this package, in a dependency authored here, or in '
        + `${read.installed === null ? `an ${INSTALLED_CATALOG_FILE} (there is none here)` : INSTALLED_CATALOG_FILE}. `
        + 'If the screen lives in another organization\'s extension, this is not a defect - but a misspelt '
        + 'sourceId installs fine and the tab never shows.',
    };
  });
};

/**
 * O relatório, a partir do diretório. O catálogo só é lido quando o pacote pendura aba em alguma tela:
 * conferir um pacote que não o faz não paga o preço de compilar todos os `plugin.ts` do diretório.
 */
export const recordSurfaceReport = (pkg: MarketplacePlugin, root: string): RecordSurfaceFinding[] =>
  referencedSourceIds(pkg).size === 0 ? [] : recordSurfaceFindings(pkg, readWorkspaceCatalog(root));
