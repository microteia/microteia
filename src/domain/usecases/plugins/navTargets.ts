import type { MarketplacePlugin } from '../../entities/MarketplacePlugin';
import type { Contribution } from '../../schema/plugin/contribution';
import type { UiNavTarget } from '../../schema/ui/uiExtensionPoints';
import { UI_MENU_POINT, UI_NAV_POINT, UI_PAGE_POINT } from '../../schema/ui/uiExtensionPoints';
import type { PageAddress } from '../../schema/ui/kernelPages';
import { KERNEL_PAGES, pageAddressMatches } from '../../schema/ui/kernelPages';
import type { LocalizedIssue } from './pluginReferences';
import { templateSourceId } from './screenModule';

const KERNEL_PLUGIN_PREFIX = 'core.';

const text = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() !== '' ? value : undefined;

/**
 * Para onde a contribuição leva, ou `null` quando ela não abre aba nenhuma — um `ui.menu` de `url`,
 * ou qualquer outro ponto. É a leitura ÚNICA do alvo: o portão do pacote, a carga no kernel e o shell
 * perguntam por aqui, e é isso que impede um deles de aceitar um alvo que o outro não sabe abrir.
 */
export const navTargetOf = (contribution: Pick<Contribution, 'point' | 'metadata'>): UiNavTarget | null => {
  const metadata = contribution?.metadata ?? {};
  if (contribution?.point === UI_NAV_POINT) {
    return { key: text(metadata.key), screen: text(metadata.screen), screenSourceId: text(metadata.screenSourceId) };
  }
  if (contribution?.point !== UI_MENU_POINT) return null;
  const action = metadata.action as Record<string, unknown> | undefined;
  if (action?.kind !== 'openTab') return null;
  return { key: text(action.tabKey), screen: text(action.screen), screenSourceId: text(action.screenSourceId) };
};

const declaredTargets = (target: UiNavTarget): number =>
  [target.key, target.screen, target.screenSourceId].filter((value) => value !== undefined).length;

/** O que uma extensão oferece a um item de menu: as páginas que desenha e as telas que declara. */
export interface NavTargetOwner {
  pluginId: string;
  pages: PageAddress[];
  screens: { key: string; sourceId: string }[];
}

export const navTargetOwnerOf = (pkg: MarketplacePlugin): NavTargetOwner => ({
  pluginId: pkg.manifest.id,
  pages: (pkg.manifest.contributes ?? [])
    .filter((contribution) => contribution?.point === UI_PAGE_POINT)
    .map((contribution) => ({
      key: text(contribution.metadata?.key) ?? '',
      keyPrefix: text(contribution.metadata?.keyPrefix),
    })),
  screens: (pkg.screens ?? []).map((screen) => ({ key: screen.key, sourceId: templateSourceId(screen) })),
});

/**
 * O veredito de UM item de menu.
 *
 * `unverifiable` é a resposta honesta de quem não enxerga uma dependência declarada: a página pode
 * morar nela, e recusar o que não se viu ensinaria o autor a ignorar a recusa. Os outros vereditos
 * que não são `ok` são recusa.
 */
export type NavTargetVerdict =
  | 'ok'
  | 'ambiguous'
  | 'dangling'
  | 'unknown-screen'
  | 'unknown-source-id'
  | 'unverifiable';

export interface NavTargetCheck {
  contributionId: string;
  index: number;
  target: UiNavTarget;
  verdict: NavTargetVerdict;
  /** A tela DESTE pacote que tem a chave que o item escreveu — o `screen:` que ele quis dizer. */
  suggestedScreen?: string;
  /** As dependências declaradas que quem perguntou não enxerga. */
  unseen: string[];
}

/**
 * Confere cada item de menu do pacote (`ui.nav` e `ui.menu` de `openTab`) contra o que ele pode abrir:
 * uma página do próprio pacote, do kernel ou de uma dependência declarada — ou uma tela que existe.
 *
 * Existe porque nada recusava o item que não leva a lugar nenhum. A aba abria, nenhum `ui.page` a
 * desenhava, e o que o usuário via era um painel em branco — sem erro e sem nome de quem o causou.
 *
 * `visible` é o que quem pergunta consegue enxergar das OUTRAS extensões. Só conta a que o pacote
 * declara em `dependencies`: uma página de extensão não declarada só existe onde ela por acaso estiver
 * instalada.
 */
export const navTargetChecks = (pkg: MarketplacePlugin, visible: NavTargetOwner[] = []): NavTargetCheck[] => {
  const own = navTargetOwnerOf(pkg);
  const dependencies = Object.keys(pkg.manifest?.dependencies ?? {})
    .filter((id) => !id.startsWith(KERNEL_PLUGIN_PREFIX) && id !== own.pluginId);
  const seen = visible.filter((owner) => dependencies.includes(owner.pluginId));
  const unseen = dependencies.filter((id) => !seen.some((owner) => owner.pluginId === id));
  const pages = [...own.pages, ...KERNEL_PAGES, ...seen.flatMap((owner) => owner.pages)];
  const sourceIds = new Set([...own.screens, ...seen.flatMap((owner) => owner.screens)].map((one) => one.sourceId));

  return (pkg.manifest?.contributes ?? []).flatMap((contribution, index): NavTargetCheck[] => {
    const target = navTargetOf(contribution);
    if (!target) return [];
    const head = { contributionId: String(contribution.id), index, target, unseen };

    if (declaredTargets(target) !== 1) return [{ ...head, verdict: 'ambiguous' }];

    if (target.screen !== undefined) {
      const known = own.screens.some((screen) => screen.key === target.screen);
      return [{ ...head, verdict: known ? 'ok' : 'unknown-screen' }];
    }

    if (target.screenSourceId !== undefined) {
      if (sourceIds.has(target.screenSourceId)) return [{ ...head, verdict: 'ok' }];
      return [{ ...head, verdict: unseen.length > 0 ? 'unverifiable' : 'unknown-source-id' }];
    }

    const key = target.key ?? '';
    if (pages.some((page) => pageAddressMatches(page, key))) return [{ ...head, verdict: 'ok' }];
    const suggestedScreen = own.screens.find((screen) => screen.key === key)?.key;
    return [{
      ...head,
      verdict: unseen.length > 0 ? 'unverifiable' : 'dangling',
      ...(suggestedScreen === undefined ? {} : { suggestedScreen }),
    }];
  });
};

/** A recusa de UM veredito, ou `null` quando ele não é recusa (`ok`, `unverifiable`). */
export const navTargetIssue = (check: NavTargetCheck): LocalizedIssue | null => {
  const where = `contributes[${check.index}]`;
  switch (check.verdict) {
    case 'ambiguous':
      return { message: '@core.marketplace/issue.package.nav.target', messageParams: { id: check.contributionId, where } };
    case 'unknown-screen':
      return {
        message: '@core.marketplace/issue.package.nav.screen-unknown',
        messageParams: { id: check.contributionId, screen: check.target.screen ?? '' },
      };
    case 'unknown-source-id':
      return {
        message: '@core.marketplace/issue.package.nav.source-id-unknown',
        messageParams: { id: check.contributionId, sourceId: check.target.screenSourceId ?? '' },
      };
    case 'dangling':
      return check.suggestedScreen === undefined
        ? { message: '@core.marketplace/issue.package.nav.dangling', messageParams: { key: check.target.key ?? '' } }
        : {
          message: '@core.marketplace/issue.package.nav.dangling.screen',
          messageParams: { key: check.target.key ?? '', screen: check.suggestedScreen },
        };
    default:
      return null;
  }
};

/** As RECUSAS — o que entra em `validatePluginPackage`. `unverifiable` fica de fora: é aviso. */
export const navTargetIssues = (pkg: MarketplacePlugin, visible: NavTargetOwner[] = []): LocalizedIssue[] =>
  navTargetChecks(pkg, visible).flatMap((check) => {
    const issue = navTargetIssue(check);
    return issue ? [issue] : [];
  });

/**
 * O pacote como o kernel o carrega: `screen` (a chave da tela NO PACOTE) vira `screenSourceId`.
 *
 * A troca é na carga, e não na gravação, porque o pacote instalado é cópia fiel do publicado; e é pelo
 * `sourceId` porque ele é o único nome da tela que sobrevive à instalação — a chave pode ganhar sufixo
 * no escritório de destino, ou ser a de uma tela que já existia lá com o mesmo `sourceId`. Quem
 * traduz o `sourceId` na aba da lista é o shell, contra as telas que o escritório tem de fato.
 */
export const withResolvedNavScreens = (pkg: MarketplacePlugin): MarketplacePlugin['manifest'] => {
  const sourceIdOf = new Map((pkg.screens ?? []).map((screen) => [screen.key, templateSourceId(screen)]));
  const resolve = (target: Record<string, unknown>): Record<string, unknown> => {
    const screen = text(target.screen);
    const sourceId = screen === undefined ? undefined : sourceIdOf.get(screen);
    if (sourceId === undefined) return target;
    const rest = Object.fromEntries(Object.entries(target).filter(([name]) => name !== 'screen'));
    return { ...rest, screenSourceId: sourceId };
  };

  return {
    ...pkg.manifest,
    contributes: (pkg.manifest.contributes ?? []).map((contribution) => {
      if (contribution?.point === UI_NAV_POINT) {
        const metadata = resolve(contribution.metadata ?? {});
        return metadata === contribution.metadata ? contribution : { ...contribution, metadata };
      }
      const action = contribution?.metadata?.action as Record<string, unknown> | undefined;
      if (contribution?.point !== UI_MENU_POINT || action?.kind !== 'openTab') return contribution;
      const resolved = resolve(action);
      return resolved === action ? contribution : { ...contribution, metadata: { ...contribution.metadata, action: resolved } };
    }),
  };
};
