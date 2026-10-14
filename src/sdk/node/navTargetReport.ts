import type { MarketplacePlugin } from '../../domain/entities/MarketplacePlugin';
import type { NavTargetCheck, NavTargetOwner } from '../../domain/usecases/plugins/navTargets';
import { navTargetChecks, navTargetIssue } from '../../domain/usecases/plugins/navTargets';
import { describeMessage } from './messages';
import type { WorkspaceCatalog } from './workspaceCatalog';
import { readWorkspaceCatalog } from './workspaceCatalog';

/**
 * Os itens de menu que só ESTE diretório responde: os que podem levar a uma dependência declarada.
 *
 * O portão do pacote (`validatePluginPackage`) não enxerga outra extensão, e por isso não recusa o
 * item que poderia abrir uma página dela — diz "não dá para conferir". Aqui as irmãs escritas neste
 * diretório estão na mão, e a pergunta passa a ter resposta: `refused` quando a dependência foi lida e
 * não desenha aquela aba, `unverifiable` quando ela não está aqui.
 *
 * Os itens que o portão já recusa sozinho não se repetem neste relatório: eles saem como problema.
 */
export type NavTargetStatus = 'ok' | 'refused' | 'unverifiable';

export interface NavTargetFinding {
  contributionId: string;
  target: string;
  status: NavTargetStatus;
  detail: string;
}

const targetText = (check: NavTargetCheck): string =>
  check.target.screenSourceId !== undefined
    ? `screenSourceId: "${check.target.screenSourceId}"`
    : `key: "${check.target.key ?? ''}"`;

export const navTargetFindings = (pkg: MarketplacePlugin, read: WorkspaceCatalog): NavTargetFinding[] => {
  const visible = read.authored
    .map((one) => one.navTargets)
    .filter((owner): owner is NavTargetOwner => owner !== undefined);
  const withWorkspace = navTargetChecks(pkg, visible);

  return navTargetChecks(pkg)
    .map((alone, index) => ({ alone, here: withWorkspace[index] }))
    .filter(({ alone }) => alone.verdict === 'unverifiable')
    .map(({ here }): NavTargetFinding => {
      const head = { contributionId: here.contributionId, target: targetText(here) };
      if (here.verdict === 'ok') {
        return { ...head, status: 'ok', detail: 'a dependency authored in this workspace draws it.' };
      }
      if (here.verdict === 'unverifiable') {
        return {
          ...head,
          status: 'unverifiable',
          detail: `cannot be checked here: ${here.unseen.join(', ')} is not authored in this workspace. If no `
            + 'page of it draws this tab, the item installs and opens an error panel.',
        };
      }
      const issue = navTargetIssue(here);
      return {
        ...head,
        status: 'refused',
        detail: issue === null ? '' : describeMessage(issue.message, issue.messageParams),
      };
    });
};

/**
 * O relatório, a partir do diretório. O catálogo só é lido quando há item que dependa dele: conferir
 * um pacote cujos itens o portão já responde sozinho não paga o preço de compilar todo `plugin.ts`.
 */
export const navTargetReport = (pkg: MarketplacePlugin, root: string): NavTargetFinding[] =>
  navTargetChecks(pkg).some((check) => check.verdict === 'unverifiable')
    ? navTargetFindings(pkg, readWorkspaceCatalog(root))
    : [];
