import type { MarketplacePlugin } from '../../domain/entities/MarketplacePlugin';
import { dependencyRange } from '../../domain/schema/plugin/pluginManifest';
import { satisfiesRange } from '../../domain/schema/plugin/semver';
import { INSTALLED_CATALOG_FILE, refreshInstalledCatalog } from './installedCatalog';
import { describeMessage } from './messages';
import type { WorkspaceCatalog } from './workspaceCatalog';
import { readWorkspaceCatalog } from './workspaceCatalog';

/**
 * A FAIXA de cada dependência, conferida contra a versão que este diretório enxerga — e o inverso: a
 * irmã daqui que declara ESTE pacote numa faixa que a versão dele não satisfaz.
 *
 * O `check` só conferia a faixa quando havia uma referência a artefato da dependência
 * (`crossRefReport`). Uma dependência declarada por outro motivo — a coleção de uma tela, um gatilho, um
 * item de menu — passava calada, e em 0.x isso morde: `^0.1.0` só admite 0.1.x. O par de irmãs saía
 * daqui sem aviso, e no escritório o `PluginHost` deixava a dependente de fora com
 * `dependency.unsatisfied`.
 *
 * - `ok`: a versão vista satisfaz a faixa.
 * - `outside-workspace`: a irmã deste diretório está fora da faixa que ESTE pacote declara — instalar
 *   os dois como estão deixa este fora do ar, em qualquer escritório.
 * - `outside-there`: a versão do retrato da instalação está fora da faixa. O pacote pode chegar lá
 *   depois da atualização da dependência.
 * - `outside-sibling`: o sentido inverso — uma irmã declara este pacote numa faixa que esta versão não
 *   satisfaz. Quem conserta é a irmã, e é no `check` dela que a recusa aparece; aqui é aviso.
 * - `absent-there` / `unverifiable`: a dependência não está no retrato, ou não há retrato nem irmã.
 *
 * Nenhum deles reprova o `check`, e de propósito: a instalação também só pede confirmação, porque a
 * atualização encadeada de duas extensões passa por um instante em que uma está fora da faixa da outra.
 * Reprovar aqui quebraria o build de quem está no meio dessa troca.
 *
 * A frase das duas faixas violadas é a do KERNEL — a mesma que a instalação mostra ao pedir
 * confirmação —, resolvida para inglês.
 */
export type DependencyRangeStatus =
  | 'ok'
  | 'outside-workspace'
  | 'outside-there'
  | 'outside-sibling'
  | 'absent-there'
  | 'unverifiable';

export interface DependencyRangeFinding {
  /** A outra extensão: a dependência, ou a irmã que depende deste pacote. */
  extension: string;
  range: string;
  status: DependencyRangeStatus;
  detail: string;
}

export const dependencyRangeFindings = (pkg: MarketplacePlugin, read: WorkspaceCatalog): DependencyRangeFinding[] => {
  const { id, version } = pkg.manifest;
  const siblings = new Map(read.authored.filter((one) => one.pluginId !== id).map((one) => [one.pluginId, one]));
  const snapshot = read.installed;
  const listedThere = new Map((snapshot?.extensions ?? []).map((one) => [one.id, one]));

  const forward = Object.entries(pkg.manifest.dependencies ?? {}).map(([dependency, declared]): DependencyRangeFinding => {
    const range = dependencyRange(declared);
    const head = { extension: dependency, range };
    const outOfRange = (installed: string): string => describeMessage(
      '@core.marketplace/install.dependency-out-of-range',
      { plugin: id, dependency, range, installed },
    );

    const sibling = siblings.get(dependency);
    if (sibling !== undefined) {
      return satisfiesRange(sibling.version, range)
        ? { ...head, status: 'ok', detail: `${dependency} ${sibling.version}, the plugin.ts in this workspace, is inside it.` }
        : { ...head, status: 'outside-workspace', detail: `${outOfRange(sibling.version)} (the plugin.ts in this workspace)` };
    }

    const there = listedThere.get(dependency);
    if (there !== undefined) {
      return satisfiesRange(there.version, range)
        ? { ...head, status: 'ok', detail: `${dependency} ${there.version} is installed in ${snapshot?.tenantName}, inside it.` }
        : {
          ...head,
          status: 'outside-there',
          detail: `${outOfRange(there.version)} (installed in ${snapshot?.tenantName}, per ${INSTALLED_CATALOG_FILE}). `
            + `Update ${dependency} there before or together with this package.`,
        };
    }

    if (snapshot === null) {
      return {
        ...head,
        status: 'unverifiable',
        detail: `${dependency} is not authored in this workspace and there is no ${INSTALLED_CATALOG_FILE} here, so its `
          + `version cannot be checked against the range. ${refreshInstalledCatalog()} — or author it beside this package.`,
      };
    }
    return {
      ...head,
      status: 'absent-there',
      detail: `${dependency} is not installed in ${snapshot.tenantName} and is not authored here: there, this package `
        + 'would install and not load until it is.',
    };
  });

  const backward = [...siblings.values()].flatMap((sibling): DependencyRangeFinding[] => {
    const range = sibling.dependencies?.[id];
    if (range === undefined || satisfiesRange(version, range)) return [];
    return [{
      extension: sibling.pluginId,
      range,
      status: 'outside-sibling',
      detail: `${describeMessage('@core.marketplace/install.dependent-out-of-range', {
        dependent: sibling.pluginId,
        plugin: id,
        range,
        version,
      })} Widen the range in ${sibling.path}, or keep this version inside it.`,
    }];
  });

  return [...forward, ...backward];
};

/**
 * O relatório, a partir do diretório. O catálogo é lido sempre: o sentido inverso não se adivinha pelo
 * pacote em mãos — é a irmã que declara a faixa.
 */
export const dependencyRangeReport = (pkg: MarketplacePlugin, root: string): DependencyRangeFinding[] =>
  dependencyRangeFindings(pkg, readWorkspaceCatalog(root));
