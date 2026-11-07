import type { MarketplacePlugin } from '../../domain/entities/MarketplacePlugin';
import type { InstalledExtensionSummary } from '../../domain/usecases/plugins/crossExtensionRefs';
import { eventRefChecks, eventRefIssue } from '../../domain/usecases/plugins/crossExtensionRefs';
import { pendingEventRefs } from '../../domain/usecases/plugins/pluginReferences';
import type { CatalogScreenInput } from '../domain/catalog';
import { collectionOfScreen } from '../domain/catalog';
import { INSTALLED_CATALOG_FILE, refreshInstalledCatalog } from './installedCatalog';
import { describeMessage, packageText } from './messages';
import type { WorkspaceCatalog } from './workspaceCatalog';
import { readWorkspaceCatalog } from './workspaceCatalog';

/**
 * Os GATILHOS que escutam outra extensão (`case.saved`), e se este diretório enxerga quem os emite.
 *
 * `validatePackage` não responde sozinho: o prefixo é da tela de uma dependência, e o pacote dela não
 * está em mãos. Aqui estão duas fontes — os `plugin.ts` deste diretório e o retrato da instalação —, e
 * o veredito sai do MESMO `eventRefChecks` que a instalação cobra, com uma diferença só: o que não se
 * enxerga daqui é dito, não recusado. É a regra que `recordSurfaces.ts` já segue.
 *
 * - `ok`: uma dependência declarada emite o prefixo.
 * - `refused`: quem emite é uma extensão que o pacote não declara — a instalação recusaria em qualquer
 *   escritório, e a frase diz qual declarar.
 * - `unverifiable`: ninguém visível emite. Pode ser uma dependência que não está aqui nem no retrato.
 */
export type EventRefStatus = 'ok' | 'refused' | 'unverifiable';

export interface EventRefFinding {
  prefix: string;
  /** Que automação do pacote escuta, resolvida para texto. */
  writtenBy: string;
  status: EventRefStatus;
  detail: string;
}

const emittedPrefix = (screen: CatalogScreenInput): string =>
  screen.eventPrefix?.trim() || collectionOfScreen(screen);

/**
 * As extensões que este diretório enxerga, na forma que o portão da instalação recebe: cada dona de
 * tela do catálogo, com os prefixos que as telas dela emitem. O catálogo já resolveu a precedência — a
 * tela do workspace vence a do retrato —, e é dele que a lista sai, não de uma segunda leitura.
 */
const visibleEmitters = (screens: readonly CatalogScreenInput[]): InstalledExtensionSummary[] => {
  const byOwner = new Map<string, Set<string>>();
  for (const screen of screens) {
    // O complemento entra no catálogo como uma segunda "tela" (`<pluginId>#patchN`) sobre a coleção
    // alvo, e quem o declara não passa a emitir o evento dela.
    if (!screen.ownerPluginId || screen.key.includes('#')) continue;
    const prefixes = byOwner.get(screen.ownerPluginId) ?? new Set<string>();
    prefixes.add(emittedPrefix(screen));
    byOwner.set(screen.ownerPluginId, prefixes);
  }
  return Array.from(byOwner, ([id, prefixes]) => ({ id, version: '0.0.0', eventPrefixes: [...prefixes] }));
};

export const eventRefFindings = (pkg: MarketplacePlugin, read: WorkspaceCatalog): EventRefFinding[] => {
  const screens = read.catalog.screens;
  const snapshot = read.installed;
  const describe = packageText(pkg);

  return eventRefChecks(pkg, visibleEmitters(screens)).map((check): EventRefFinding => {
    const head = {
      prefix: check.prefix,
      writtenBy: `${describeMessage(check.ref.from.origin)} "${describe(check.ref.from.name)}"`,
    };
    const { verdict } = check;

    if (verdict.kind === 'ok') {
      const emitter = screens.find((screen) =>
        screen.ownerPluginId === verdict.pluginId && emittedPrefix(screen) === check.prefix);
      const where = emitter?.source === 'installation'
        ? `${INSTALLED_CATALOG_FILE}, taken ${snapshot?.ageDays ?? '?'} day(s) ago`
        : `the plugin.ts of ${verdict.pluginId} in this workspace`;
      return {
        ...head,
        status: 'ok',
        detail: `the screen "${emitter?.key ?? '?'}" of ${verdict.pluginId}, a declared dependency, emits it, according to ${where}.`,
      };
    }

    if (verdict.kind === 'undeclared') {
      const issue = eventRefIssue(check);
      return {
        ...head,
        status: 'refused',
        detail: issue === null
          ? ''
          : describeMessage(issue.message, { ...issue.messageParams, name: describe(check.ref.from.name) }),
      };
    }

    const designed = screens.find((screen) => !screen.ownerPluginId && emittedPrefix(screen) === check.prefix);
    if (designed !== undefined) {
      return {
        ...head,
        status: 'unverifiable',
        detail: `the screen "${designed.key}" emits it in ${snapshot?.tenantName ?? 'the installation'}, but it `
          + 'belongs to no extension, and only a screen of a declared dependency covers a trigger. Installing '
          + 'this package there would be refused.',
      };
    }

    return {
      ...head,
      status: 'unverifiable',
      detail: 'no screen of this package, of the kernel, of a plugin.ts in this workspace or of '
        + `${snapshot === null ? `an ${INSTALLED_CATALOG_FILE} (there is none here)` : INSTALLED_CATALOG_FILE} `
        + 'emits it. If the declared dependency that emits it is authored elsewhere, this is not a defect — '
        + `but installing would be refused where none of them does. ${refreshInstalledCatalog(snapshot?.tenantId ?? '<tenantId>')} `
        + '— or author the dependency beside this package.',
    };
  });
};

/**
 * O relatório, a partir do diretório. O catálogo só é lido quando há gatilho pendente: conferir um
 * pacote que só escuta o que emite não paga o preço de compilar todos os `plugin.ts` do diretório.
 */
export const eventRefReport = (pkg: MarketplacePlugin, root: string): EventRefFinding[] =>
  pendingEventRefs(pkg).length === 0 ? [] : eventRefFindings(pkg, readWorkspaceCatalog(root));
