import type { MarketplacePlugin, TemplateField } from '../../entities/MarketplacePlugin';
import { FIELD_VISIBLE_IN_SINCE_KERNEL, fieldVisibilityIssues } from '../../schema/fieldVisibility';
import { rangeExcludesBelow } from '../../schema/plugin/semver';
import type { LocalizedIssue } from './pluginReferences';

const ISSUE_MESSAGE = {
  shape: '@core.marketplace/issue.field.visible-in.shape',
  surface: '@core.marketplace/issue.field.visible-in.surface',
  contradicts: '@core.marketplace/issue.field.visible-in.contradicts',
} as const;

/**
 * O `visibleIn` dos campos do pacote (issue #12): a forma, as superfícies e o `kernel`.
 *
 * A contradição com o atalho declarado ao lado (`hiddenInForm: true` com `form` na lista) é RECUSA, e não
 * aviso: `visibleIn` venceria em silêncio, e o autor que lê só a outra metade da declaração esperaria o
 * contrário do que a tela faz. O atalho que concorda passa.
 *
 * O `kernel` é de GARANTIA, como o do `editWindow`: um kernel anterior ignora a chave, e o campo que o
 * autor tirou do formulário apareceria nele.
 */
export const packageFieldVisibilityIssues = (pkg: MarketplacePlugin): LocalizedIssue[] => {
  const owners: { screen: string; fields: readonly TemplateField[] }[] = [
    ...(pkg.screens ?? []).map((screen) => ({ screen: screen.key, fields: screen.fields ?? [] })),
    ...(pkg.screenPatches ?? []).map((patch) => ({ screen: patch.target, fields: patch.fields ?? [] })),
  ];

  const shape = owners.flatMap(({ screen, fields }) => fields.flatMap((field) =>
    fieldVisibilityIssues(field).map((issue): LocalizedIssue => ({
      message: ISSUE_MESSAGE[issue.kind],
      messageParams: {
        screen,
        field: field.key,
        ...(issue.kind === 'surface' ? { surface: issue.surface } : {}),
        ...(issue.kind === 'contradicts' ? { flag: issue.flag } : {}),
      },
    }))));

  const declaring = owners
    .flatMap(({ screen, fields }) => fields.map((field) => ({ screen, field })))
    .find(({ field }) => field.visibleIn !== undefined && field.visibleIn !== null);
  const kernel = declaring && !rangeExcludesBelow(pkg.manifest.kernel ?? '', FIELD_VISIBLE_IN_SINCE_KERNEL)
    ? [{
      message: '@core.marketplace/issue.field.visible-in.kernel',
      messageParams: { screen: declaring.screen, field: declaring.field.key, minimum: FIELD_VISIBLE_IN_SINCE_KERNEL },
    }]
    : [];

  return [...shape, ...kernel];
};
