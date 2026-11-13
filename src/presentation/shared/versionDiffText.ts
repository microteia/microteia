import type { ArtifactVersionChange, DiffStepRef } from '../../domain/services/artifactVersionDiff';

type Label = (value: string | null | undefined, params?: Record<string, string>) => string;

/**
 * O nome de cada campo de conteúdo, por REFERÊNCIA. Tabela literal, e não montada, para que
 * `verify-messages` confira cada uma: uma chave de conteúdo nova sem nome reprova aqui, e não aparece
 * crua na comparação.
 */
const FIELD_LABEL_REFS: Readonly<Record<string, string>> = {
  name: '@core.automation/versions.field.name',
  description: '@core.automation/versions.field.description',
  eventName: '@core.automation/versions.field.event-name',
  lookupCollection: '@core.automation/versions.field.lookup-collection',
  parameters: '@core.automation/versions.field.parameters',
  schedule: '@core.automation/versions.field.schedule',
  dateReached: '@core.automation/versions.field.date-reached',
  changeType: '@core.automation/versions.field.change-type',
  changedFields: '@core.automation/versions.field.changed-fields',
  condition: '@core.automation/versions.field.condition',
  inputParams: '@core.automation/versions.field.input-params',
  outputParams: '@core.automation/versions.field.output-params',
  sourceTs: '@core.automation/versions.field.source',
};

const NODE_LABEL_REFS: Readonly<Record<string, string>> = {
  Condition: '@core.automation/versions.node.condition',
  Loop: '@core.automation/versions.node.loop',
  Switch: '@core.automation/versions.node.switch',
};

/**
 * As diferenças entre duas versões como frases. `stepName` dá o nome do passo do catálogo; o id vai junto,
 * porque dois passos "Notificar" na mesma automação são indistinguíveis só pelo nome.
 */
export const describeVersionChanges = (
  changes: readonly ArtifactVersionChange[],
  label: Label,
  stepName: (stepDefinitionId: string) => string,
): string[] => {
  const field = (key: string) => (FIELD_LABEL_REFS[key] ? label(FIELD_LABEL_REFS[key]) : key);
  const step = (ref: DiffStepRef) => {
    const name = NODE_LABEL_REFS[ref.type] ? label(NODE_LABEL_REFS[ref.type]) : (stepName(ref.stepDefinitionId) || ref.stepDefinitionId);
    return `${name} (${ref.stepId})`;
  };
  return changes.map((change) => {
    switch (change.kind) {
      case 'field':
        return label('@core.automation/versions.diff.field', { field: field(change.key) });
      case 'code':
        return label('@core.automation/versions.diff.code', {
          field: field(change.key), added: String(change.added), removed: String(change.removed),
        });
      case 'step-added':
        return label('@core.automation/versions.diff.step-added', { step: step(change) });
      case 'step-removed':
        return label('@core.automation/versions.diff.step-removed', { step: step(change) });
      case 'step-moved':
        return label('@core.automation/versions.diff.step-moved', { step: step(change) });
      case 'step-changed':
        return label('@core.automation/versions.diff.step-changed', {
          step: step(change),
          keys: change.keys.map((key) => key.replace(/^configuration\./, '')).join(', '),
        });
    }
  });
};
