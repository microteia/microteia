import type { MarketplacePlugin, ScreenModuleTemplate } from '../../entities/MarketplacePlugin';
import { PORTAL_VISIBLE_WHEN_SINCE_KERNEL, asPortalDeclaration, portalVisibilityIssues } from '../../schema/portal';
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
export const packagePortalIssues = (pkg: MarketplacePlugin): LocalizedIssue[] => {
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
