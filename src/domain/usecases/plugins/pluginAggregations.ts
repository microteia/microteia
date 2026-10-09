import type { MarketplacePlugin, TemplateField } from '../../entities/MarketplacePlugin';
import { AGGREGATION_OP_SINCE_KERNEL, fieldAggregationIssues } from '../../schema/aggregationSpec';
import { rangeExcludesBelow } from '../../schema/plugin/semver';
import type { LocalizedIssue } from './pluginReferences';

interface DeclaredAggregation {
  screen: string;
  field: TemplateField;
}

const declaredAggregations = (pkg: MarketplacePlugin): DeclaredAggregation[] => [
  ...(pkg.screens ?? []).flatMap((screen) =>
    screen.fields.map((field) => ({ screen: screen.key, field }))),
  ...(pkg.screenPatches ?? []).flatMap((patch) =>
    patch.fields.map((field) => ({ screen: patch.target, field }))),
].filter((entry) => Boolean(entry.field.aggregation));

/**
 * A forma de cada `aggregation` do pacote, e o `kernel` que ela exige.
 *
 * Os campos do filho só são conferidos quando a tela dele vem no próprio pacote: a de uma dependência
 * ou do kernel não está aqui para ser lida, e recusar o que não se pode ver recusaria um pacote certo.
 *
 * A segunda checagem é o que faz um kernel ANTIGO recusar o pacote em vez de ignorar a operação: ele
 * não sabe o que é `latest`, mas sabe recusar um intervalo de `kernel` que não o inclui.
 */
export const packageAggregationIssues = (pkg: MarketplacePlugin): LocalizedIssue[] => {
  const screenFields = new Map((pkg.screens ?? []).map((screen) => [screen.key, screen.fields]));

  return declaredAggregations(pkg).flatMap(({ screen, field }) => {
    const aggregation = field.aggregation;
    if (!aggregation) return [];

    const shape = fieldAggregationIssues(aggregation, field, screenFields.get(aggregation.from) ?? null)
      .map((issue): LocalizedIssue => ({
        message: '@core.marketplace/issue.aggregation.invalid',
        messageParams: { ...(issue.messageParams ?? {}), screen, field: field.key, detail: issue.message },
      }));

    const minimum = AGGREGATION_OP_SINCE_KERNEL[aggregation.op];
    const kernel = minimum && !rangeExcludesBelow(pkg.manifest.kernel, minimum)
      ? [{
          message: '@core.marketplace/issue.aggregation.kernel',
          messageParams: { screen, field: field.key, op: aggregation.op, minimum },
        }]
      : [];

    return [...shape, ...kernel];
  });
};
