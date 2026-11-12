import type { MarketplacePlugin } from '../../entities/MarketplacePlugin';
import { rangeExcludesBelow } from '../../schema/plugin/semver';
import { PORTAL_VIEW_POINT } from '../../schema/portalExtensionPoints';
import { WIDGET_DATA_SINCE_KERNEL, widgetDataFeatures } from '../../schema/ui/widgetSpec';
import type { LocalizedIssue } from './pluginReferences';

/**
 * O `kernel` das telas em Widget DSL que LIGAM DADOS (`metric` com relatório, `report` com respostas
 * ou vista, a barra `filters`).
 *
 * É de garantia: um kernel anterior ignora o nó que não conhece — e a barra `filters` levaria com ela
 * o painel inteiro que está dentro dela, sem aviso. O cartão do portal fica de fora: ele tem o próprio
 * vocabulário (`portalWidget.ts`), conferido em `pluginPortal`.
 */
export const packageWidgetDataIssues = (pkg: MarketplacePlugin): LocalizedIssue[] => {
  if (rangeExcludesBelow(pkg.manifest?.kernel ?? '', WIDGET_DATA_SINCE_KERNEL)) return [];
  return (pkg.manifest?.contributes ?? []).flatMap((contribution): LocalizedIssue[] => {
    if (contribution?.point === PORTAL_VIEW_POINT || contribution?.impl?.kind !== 'widget') return [];
    const [feature] = widgetDataFeatures(contribution.impl.spec);
    return feature
      ? [{
        message: '@core.marketplace/issue.widget.data-kernel',
        messageParams: { contribution: contribution.id, feature, minimum: WIDGET_DATA_SINCE_KERNEL },
      }]
      : [];
  });
};
