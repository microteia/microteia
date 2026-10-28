import type { MarketplacePlugin, ScreenModuleTemplate } from '../../entities/MarketplacePlugin';
import {
  PORTAL_ACTIONS_SINCE_KERNEL,
  PORTAL_DOCUMENT_LINKS_SINCE_KERNEL,
  PORTAL_DOCUMENT_LINK_MAX_MINUTES,
  PORTAL_TRACK_VIEWS_SINCE_KERNEL,
  PORTAL_VISIBLE_WHEN_SINCE_KERNEL,
  asPortalDeclaration,
  portalActionIssues,
  portalDerivedFieldKeys,
  portalVisibilityIssues,
} from '../../schema/portal';
import { rangeExcludesBelow } from '../../schema/plugin/semver';
import type { LocalizedIssue } from './pluginReferences';

const fieldsOf = (pkg: MarketplacePlugin, screen: ScreenModuleTemplate) => [
  ...screen.fields,
  ...(pkg.screenPatches ?? [])
    .filter((patch) => patch.target === screen.key || (screen.sourceId !== undefined && patch.target === screen.sourceId))
    .flatMap((patch) => patch.fields),
];

/**
 * O `visibleWhen` das telas do pacote: a sintaxe, os campos citados e o `kernel`.
 *
 * A checagem do `kernel` não é de forma, é de EXPOSIÇÃO: um kernel anterior descarta a chave ao ler a
 * declaração e projeta todos os registros da tela — inclusive os que a extensão quis manter dentro do
 * escritório. Exigir o kernel faz o antigo recusar o pacote em vez de abrir o que não devia.
 */
const visibleWhenIssues = (pkg: MarketplacePlugin): LocalizedIssue[] => {
  const filtered = (pkg.screens ?? []).flatMap((screen) => {
    const portal = asPortalDeclaration(screen.portal);
    return portal?.visibleWhen ? [{ screen, portal }] : [];
  });

  const condition = filtered.flatMap(({ screen, portal }) =>
    portalVisibilityIssues({ id: screen.key, collection: screen.key, fields: fieldsOf(pkg, screen), portal })
      .map((issue): LocalizedIssue => issue.messageParams?.field
        ? {
          message: '@core.marketplace/issue.portal.visible-when.unknown',
          messageParams: { screen: screen.key, field: issue.messageParams.field },
        }
        : { message: '@core.marketplace/issue.portal.visible-when.invalid', messageParams: { screen: screen.key } }));

  const kernel = filtered.length > 0 && !rangeExcludesBelow(pkg.manifest.kernel ?? '', PORTAL_VISIBLE_WHEN_SINCE_KERNEL)
    ? [{
      message: '@core.marketplace/issue.portal.visible-when.kernel',
      messageParams: { screen: filtered[0].screen.key, minimum: PORTAL_VISIBLE_WHEN_SINCE_KERNEL },
    }]
    : [];

  return [...condition, ...kernel];
};

/**
 * O `documentLinks` das telas do pacote: a validade e o `kernel`. Pela mesma razão do `visibleWhen`, o
 * `kernel` é de exposição — o anterior descarta a chave e entrega ao convidado o link permanente.
 */
const documentLinkIssues = (pkg: MarketplacePlugin): LocalizedIssue[] => {
  const signed = (pkg.screens ?? []).flatMap((screen) => {
    const links = asPortalDeclaration(screen.portal)?.documentLinks;
    return links ? [{ screen, links }] : [];
  });

  const minutes = signed
    .filter(({ links }) => !Number.isInteger(links.expiresInMinutes)
      || links.expiresInMinutes < 1
      || links.expiresInMinutes > PORTAL_DOCUMENT_LINK_MAX_MINUTES)
    .map(({ screen }): LocalizedIssue => ({
      message: '@core.marketplace/issue.portal.document-links.minutes',
      messageParams: { screen: screen.key, maximum: String(PORTAL_DOCUMENT_LINK_MAX_MINUTES) },
    }));

  const kernel = signed.length > 0 && !rangeExcludesBelow(pkg.manifest.kernel ?? '', PORTAL_DOCUMENT_LINKS_SINCE_KERNEL)
    ? [{
      message: '@core.marketplace/issue.portal.document-links.kernel',
      messageParams: { screen: signed[0].screen.key, minimum: PORTAL_DOCUMENT_LINKS_SINCE_KERNEL },
    }]
    : [];

  return [...minutes, ...kernel];
};

/**
 * O `trackViews` das telas do pacote num kernel que o descarta: nenhuma abertura seria registrada, e a
 * automação que escuta `<prefixo>.portalViewed` nunca rodaria — calada, que é o pior jeito de falhar
 * para quem declarou justamente para ter prova.
 */
const trackViewsIssues = (pkg: MarketplacePlugin): LocalizedIssue[] => {
  const tracked = (pkg.screens ?? []).find((screen) => asPortalDeclaration(screen.portal)?.trackViews === true);
  return tracked && !rangeExcludesBelow(pkg.manifest.kernel ?? '', PORTAL_TRACK_VIEWS_SINCE_KERNEL)
    ? [{
      message: '@core.marketplace/issue.portal.track-views.kernel',
      messageParams: { screen: tracked.key, minimum: PORTAL_TRACK_VIEWS_SINCE_KERNEL },
    }]
    : [];
};

/**
 * O campo derivado levado ao portal: ele nunca é gravado, e o convidado o veria sempre vazio. O pacote
 * não passa pela aba Portal do Form Design, e por isso a mesma conferência é recusa aqui.
 */
const derivedFieldIssues = (pkg: MarketplacePlugin): LocalizedIssue[] =>
  (pkg.screens ?? []).flatMap((screen) => {
    const portal = asPortalDeclaration(screen.portal);
    if (!portal) return [];
    return portalDerivedFieldKeys({ id: screen.key, collection: screen.key, fields: fieldsOf(pkg, screen), portal })
      .map((field): LocalizedIssue => ({
        message: '@core.marketplace/issue.portal.field.derived',
        messageParams: { screen: screen.key, field },
      }));
  });

const PORTAL_ACTION_PACKAGE_MESSAGES: Record<string, string> = {
  '@core.records/portal.issue.action.unknown': '@core.marketplace/issue.portal.action.unknown',
  '@core.records/portal.issue.action.disabled': '@core.marketplace/issue.portal.action.disabled',
  '@core.records/portal.issue.action.not-runnable': '@core.marketplace/issue.portal.action.not-runnable',
  '@core.records/portal.issue.action.prompts': '@core.marketplace/issue.portal.action.prompts',
};

/**
 * As `actions` das telas do pacote: cada chave aponta para uma ação DO PACOTE que a tela põe no
 * cabeçalho do registro (`viewActionIds`, que no pacote são `templateId`), ligada, que roda uma
 * automação e não pergunta nada — e o `kernel` que lê a chave. A chave, e não o id, porque a `key`
 * atravessa a instalação intacta, enquanto o id é remapeado: a declaração não precisa de reescrita.
 */
const actionIssues = (pkg: MarketplacePlugin): LocalizedIssue[] => {
  const declaring = (pkg.screens ?? []).flatMap((screen) => {
    const portal = asPortalDeclaration(screen.portal);
    return portal?.actions?.length ? [{ screen, portal }] : [];
  });
  const actions = (pkg.actions ?? []).map((action) => ({ ...action, id: action.templateId }));

  const keys = declaring.flatMap(({ screen, portal }) =>
    portalActionIssues(
      { id: screen.key, collection: screen.key, fields: screen.fields, viewActionIds: screen.viewActionIds, portal },
      actions,
    ).map((issue): LocalizedIssue => ({
      message: PORTAL_ACTION_PACKAGE_MESSAGES[issue.message] ?? issue.message,
      messageParams: { screen: screen.key, action: issue.messageParams?.action ?? '' },
    })));

  const kernel = declaring.length > 0 && !rangeExcludesBelow(pkg.manifest.kernel ?? '', PORTAL_ACTIONS_SINCE_KERNEL)
    ? [{
      message: '@core.marketplace/issue.portal.actions.kernel',
      messageParams: { screen: declaring[0].screen.key, minimum: PORTAL_ACTIONS_SINCE_KERNEL },
    }]
    : [];

  return [...keys, ...kernel];
};

/** O que o portal das telas do pacote declara e o kernel exigido não sustenta — cada um, uma recusa. */
export const packagePortalIssues = (pkg: MarketplacePlugin): LocalizedIssue[] => [
  ...derivedFieldIssues(pkg),
  ...visibleWhenIssues(pkg),
  ...documentLinkIssues(pkg),
  ...trackViewsIssues(pkg),
  ...actionIssues(pkg),
];
