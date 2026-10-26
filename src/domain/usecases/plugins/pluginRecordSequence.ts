import type { MarketplacePlugin } from '../../entities/MarketplacePlugin';
import type { RecordSequenceIssueCode } from '../../schema/recordSequence';
import { isSequenceField, RECORD_SEQUENCE_SINCE_KERNEL, recordSequenceIssues } from '../../schema/recordSequence';
import { rangeExcludesBelow } from '../../schema/plugin/semver';
import type { LocalizedIssue } from './pluginReferences';

const ISSUE_MESSAGE: Record<RecordSequenceIssueCode, string> = {
  shape: '@core.marketplace/issue.record-sequence.shape',
  scope: '@core.marketplace/issue.record-sequence.scope',
  reset: '@core.marketplace/issue.record-sequence.reset',
  nested: '@core.marketplace/issue.record-sequence.nested',
  'field-type': '@core.marketplace/issue.record-sequence.field-type',
  'pattern-slot': '@core.marketplace/issue.record-sequence.pattern-slot',
  'pattern-numeric': '@core.marketplace/issue.record-sequence.pattern-numeric',
  'pattern-year': '@core.marketplace/issue.record-sequence.pattern-year',
  'scope-needs-parent': '@core.marketplace/issue.record-sequence.scope-needs-parent',
};

/**
 * Os campos numerados (`autoValue.sequence`) do pacote — nas telas que ele traz e nos campos que ele
 * acrescenta a telas de outros (`screenPatches`). A forma é recusada aqui porque cada defeito dela é
 * um número REPETIDO em produção, e não um número feio: o ano que recomeça sem `YYYY` no padrão
 * produz `000001` duas vezes.
 *
 * Num patch o pai da tela-alvo não é conhecido no pacote, e por isso o escopo `parent` não é cobrado
 * ali — a gravação recusa, com o motivo, o registro sem pai.
 *
 * O `kernel` é de GARANTIA: um kernel anterior não conhece `sequence` e leria `YYYY/000000` como um
 * padrão de SORTEIO — o número viraria um código aleatório, e o que a extensão promete único poderia
 * se repetir.
 */
export const packageRecordSequenceIssues = (pkg: MarketplacePlugin): LocalizedIssue[] => {
  const owners = [
    ...(pkg.screens ?? []).map((screen) => ({
      screen: screen.key,
      fields: screen.fields,
      hasParent: !!screen.parentFieldKey,
    })),
    ...(pkg.screenPatches ?? []).map((patch) => ({ screen: patch.target, fields: patch.fields, hasParent: true })),
  ];

  const shape = owners.flatMap((owner) =>
    recordSequenceIssues(owner.fields, { hasParent: owner.hasParent }).map((issue): LocalizedIssue => ({
      message: ISSUE_MESSAGE[issue.code],
      messageParams: { screen: owner.screen, field: issue.field },
    })));

  const declaring = owners.find((owner) => owner.fields.some(isSequenceField));
  const kernel = declaring && !rangeExcludesBelow(pkg.manifest.kernel ?? '', RECORD_SEQUENCE_SINCE_KERNEL)
    ? [{
      message: '@core.marketplace/issue.record-sequence.kernel',
      messageParams: { screen: declaring.screen, minimum: RECORD_SEQUENCE_SINCE_KERNEL },
    }]
    : [];

  return [...shape, ...kernel];
};
