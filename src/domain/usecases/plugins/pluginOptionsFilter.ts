import type { MarketplacePlugin, TemplateField } from '../../entities/MarketplacePlugin';
import { OPTIONS_FILTER_OPERATORS, optionsFilterIssues } from '../../schema/optionsFilter';
import type { OptionsFilterIssueCode } from '../../schema/optionsFilter';
import type { LocalizedIssue } from './pluginReferences';

const ISSUE_MESSAGE: Record<OptionsFilterIssueCode, string> = {
  type: '@core.marketplace/issue.options-filter.type',
  shape: '@core.marketplace/issue.options-filter.shape',
  'lookup-path': '@core.marketplace/issue.options-filter.lookup-path',
  'reference-path': '@core.marketplace/issue.options-filter.reference-path',
  source: '@core.marketplace/issue.options-filter.source',
  self: '@core.marketplace/issue.options-filter.self',
};

/**
 * O `optionsFilter` dos campos do pacote — nas telas que ele traz e nos campos que ele acrescenta a
 * telas de outros. A tela apontada só é conferida quando também vem no pacote; a tela dona de um
 * patch, nunca: as duas só são conhecidas inteiras no escritório.
 */
export const packageOptionsFilterIssues = (pkg: MarketplacePlugin): LocalizedIssue[] => {
  const fieldKeysByScreen = new Map(
    (pkg.screens ?? []).map((screen) => [screen.key, new Set((screen.fields ?? []).map((field) => field.key))]),
  );

  const issuesOf = (screen: string, fields: readonly TemplateField[], screenFieldKeys?: ReadonlySet<string>) =>
    fields.flatMap((field) =>
      optionsFilterIssues(field, {
        screenFieldKeys,
        targetFieldKeys: field.refEntity ? fieldKeysByScreen.get(field.refEntity) : undefined,
      }).map((issue): LocalizedIssue => ({
        message: ISSUE_MESSAGE[issue.code],
        messageParams: {
          screen,
          field: field.key,
          ...(issue.path ? { path: issue.path } : {}),
          ...(issue.source ? { source: issue.source } : {}),
          ...(issue.code === 'reference-path' ? { target: field.refEntity ?? '' } : {}),
          ...(issue.code === 'shape' ? { operators: OPTIONS_FILTER_OPERATORS.join(', ') } : {}),
        },
      })));

  return [
    ...(pkg.screens ?? []).flatMap((screen) =>
      issuesOf(screen.key, screen.fields ?? [], fieldKeysByScreen.get(screen.key))),
    ...(pkg.screenPatches ?? []).flatMap((patch) => issuesOf(patch.target, patch.fields ?? [])),
  ];
};
