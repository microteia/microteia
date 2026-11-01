import type { MarketplacePlugin } from '../../domain/entities/MarketplacePlugin';
import {
  ACTION_RECORD_PARAMETER,
  ACTION_RETURN_KEYS,
  ACTION_STATUS_CODES,
  ACTION_SYSTEM_PARAMETER_KEYS,
} from '../../domain/entities/Action';
import { parseArtifactRef } from '../../domain/schema/plugin/artifactRef';
import type { ActionReturnGap } from '../../domain/schema/actionReturn';
import { actionReturnGaps } from '../../domain/schema/actionReturn';
import { packageText } from './messages';

/**
 * O CONTRATO entre a action e o fluxo que ela dispara, conferido no pacote.
 *
 * Três defeitos que instalam, rodam e só aparecem no clique — e por isso cada um aqui é aviso, nunca
 * recusa: o pacote que já roda assim continua rodando, e recusá-lo agora quebraria quem já usa.
 *
 * - `no-return`: um caminho do fluxo termina num passo sem `result`, `status` nem `actions`. O fluxo
 *   roda inteiro, e o botão diz que nada voltou.
 * - `defaults-without-prompt`: `parameterDefaults` preenche o FORMULÁRIO que `promptParameters` abre.
 *   Sem o formulário, o mapa nunca é avaliado, e o parâmetro chega vazio.
 * - `required-unsent`: o fluxo exige um parâmetro que o botão, sem formulário, não tem como mandar — a
 *   execução é recusada antes do primeiro passo.
 *
 * Só a ação que aponta para um fluxo DESTE pacote é conferida: o fluxo de outra extensão não está em
 * mãos, e o que não se lê não se afirma.
 */
export type ActionReturnFindingKind = 'no-return' | 'defaults-without-prompt' | 'required-unsent';

export interface ActionReturnFinding {
  action: string;
  /** Que fluxo, resolvido para texto. */
  workflow: string;
  kind: ActionReturnFindingKind;
  detail: string;
}

const quoted = (values: readonly string[]): string => values.map((value) => `"${value}"`).join(', ');

const describeGap = (gap: ActionReturnGap): string =>
  gap.stepId === null
    ? 'a path where no step runs (an "exit" with nothing before it, or a branch that ends the flow empty)'
    : `step "${gap.stepId}" (${gap.stepDefinitionId ?? 'step'})`;

const NO_RETURN_FIX = `End every path in a "map" step with NO name, which publishes its fields at the root: `
  + `${quoted(ACTION_RETURN_KEYS)}. "status" takes ${quoted(ACTION_STATUS_CODES)}, "actions" a list such as ["refresh"]. `
  + 'A refusal returns status "ERROR" with its message in that map, BEFORE the "exit" — the exit keeps the step '
  + 'before it as the return.';

export const actionReturnReport = (pkg: MarketplacePlugin): ActionReturnFinding[] => {
  const describe = packageText(pkg);
  const workflows = new Map(pkg.workflows.map((workflow) => [workflow.templateId, workflow]));
  const findings: ActionReturnFinding[] = [];

  for (const action of pkg.actions ?? []) {
    if (action.command || !action.workflowId || parseArtifactRef(action.workflowId)) continue;
    const workflow = workflows.get(action.workflowId);
    if (workflow === undefined) continue;
    const head = { action: action.key, workflow: describe(workflow.name) || workflow.templateId };

    const gaps = actionReturnGaps(workflow.steps);
    if (gaps.length > 0) {
      findings.push({
        ...head,
        kind: 'no-return',
        detail: `The button reads ${quoted(ACTION_RETURN_KEYS)} from the LAST step that runs, and gets none on `
          + `${gaps.map(describeGap).join('; ')}. The flow runs all the same, and the button reports that nothing `
          + `came back. ${NO_RETURN_FIX}`,
      });
    }

    if (action.promptParameters) continue;

    const mapped = Object.keys(action.parameterDefaults ?? {});
    if (mapped.length > 0) {
      findings.push({
        ...head,
        kind: 'defaults-without-prompt',
        detail: `parameterDefaults fills the parameter form that promptParameters opens, and this action does not `
          + `open it: ${quoted(mapped)} never get a value from it. The button's record always reaches the flow as `
          + `"${ACTION_RECORD_PARAMETER}" — declare that parameter (type EntityReference, entityType = the collection) `
          + 'instead of mapping the record\'s id.',
      });
    }

    const system = new Set<string>(ACTION_SYSTEM_PARAMETER_KEYS);
    const unsent = (workflow.parameters ?? [])
      .filter((parameter) => parameter.required && !system.has(parameter.key))
      .filter((parameter) => parameter.defaultValue === undefined || parameter.defaultValue === null || parameter.defaultValue === '')
      .map((parameter) => parameter.key);
    if (unsent.length > 0) {
      findings.push({
        ...head,
        kind: 'required-unsent',
        detail: `the flow requires ${quoted(unsent)}, and without promptParameters the button sends only `
          + `${quoted(ACTION_SYSTEM_PARAMETER_KEYS)}: every run is refused before the first step. Ask for it with `
          + `promptParameters, give it a defaultValue, or read the record through "${ACTION_RECORD_PARAMETER}".`,
      });
    }
  }

  return findings;
};
