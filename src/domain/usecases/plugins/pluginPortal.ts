import type { MarketplacePlugin, ScreenModuleTemplate } from '../../entities/MarketplacePlugin';
import {
  PORTAL_DOCUMENT_LINKS_SINCE_KERNEL,
  PORTAL_DOCUMENT_LINK_MAX_MINUTES,
  PORTAL_VISIBLE_WHEN_SINCE_KERNEL,
  asPortalDeclaration,
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

/** O que o portal das telas do pacote declara e o kernel exigido não sustenta — cada um, uma recusa. */
export const packagePortalIssues = (pkg: MarketplacePlugin): LocalizedIssue[] => [
  ...visibleWhenIssues(pkg),
  ...documentLinkIssues(pkg),
];
