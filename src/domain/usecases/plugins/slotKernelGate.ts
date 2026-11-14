import type { MarketplacePlugin } from '../../entities/MarketplacePlugin';
import { rangeExcludesBelow } from '../../schema/plugin/semver';
import { SLOT_DOCK_SINCE_KERNEL, UI_SLOT_POINT, WORKSPACE_SLOT_SURFACES } from '../../schema/ui/uiExtensionPoints';
import type { LocalizedIssue } from './pluginReferences';

/**
 * O trecho que usa o que só existe a partir de `SLOT_DOCK_SINCE_KERNEL` — o dock, ou o portão por
 * function — num pacote que admite kernel anterior. Lá ele instalaria e não apareceria (ou apareceria
 * sem a function no ar), sem erro em lugar nenhum; a recusa aqui é o que faz o autor ouvir o motivo.
 */
export const slotKernelIssues = (pkg: MarketplacePlugin): LocalizedIssue[] => {
  const kernel = pkg.manifest?.kernel ?? '';
  if (rangeExcludesBelow(kernel, SLOT_DOCK_SINCE_KERNEL)) return [];
  return (pkg.manifest?.contributes ?? []).flatMap((contribution): LocalizedIssue[] => {
    if (contribution?.point !== UI_SLOT_POINT) return [];
    const metadata = contribution.metadata ?? {};
    const usesDock = metadata.surface === WORKSPACE_SLOT_SURFACES.dockRight;
    const usesGate = typeof metadata.requiresFunction === 'string' && metadata.requiresFunction !== '';
    if (!usesDock && !usesGate) return [];
    return [{
      message: '@core.marketplace/issue.package.slot.kernel',
      messageParams: { id: String(contribution.id), minimum: SLOT_DOCK_SINCE_KERNEL },
    }];
  });
};
