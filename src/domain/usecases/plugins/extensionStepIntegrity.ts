import type { MarketplacePlugin } from '../../entities/MarketplacePlugin';
import type { WorkflowStep } from '../../entities/Workflow';
import { flattenSteps } from '../../services/stepTree';
import { WORKFLOW_CALLED_EVENT } from '../../schema/eventCatalog';
import { isPausingStepDefinition } from '../../schema/workflowStepCatalog';
import { isScreenIconKey } from '../../schema/ui/screenIconCatalog';
import { rangeExcludesBelow } from '../../schema/plugin/semver';
import {
  EXTENSION_STEPS_SINCE_KERNEL,
  WORKFLOW_STEP_POINT,
  isExtensionStepKey,
} from '../../schema/workflowStepContribution';

export interface ExtensionStepIssue {
  message: string;
  messageParams: Record<string, string>;
}

const text = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

/** O corpo PAUSA: o passo espera o resultado no mesmo processo, e uma pausa ali falharia com o fluxo rodando. */
const pausingStepOf = (steps: readonly WorkflowStep[]): WorkflowStep | undefined =>
  flattenSteps(steps).find((step) => isPausingStepDefinition(step.stepDefinitionId) || step.loop?.query !== undefined);

/**
 * A integridade dos passos que o pacote DECLARA (`workflow.step`) — o "conector".
 *
 * Cada recusa fecha um defeito que só apareceria na execução, longe de quem empacotou:
 * - corpo que não é automação nem script: é a única forma de um terceiro rodar algo sem código no servidor;
 * - corpo que não está no pacote: o passo apontaria para o vazio no escritório que instalou;
 * - automação que não é "chamada": só ela recebe parâmetros e devolve resultado;
 * - automação que pausa: o passo espera no mesmo processo, e a pausa falharia com o fluxo rodando;
 * - kernel que admite versão sem o ponto: lá o passo simplesmente não existiria.
 */
export const extensionStepIssues = (pkg: MarketplacePlugin): ExtensionStepIssue[] => {
  const contributions = (pkg.manifest?.contributes ?? []).filter((one) => one?.point === WORKFLOW_STEP_POINT);
  if (contributions.length === 0) return [];
  const issues: ExtensionStepIssue[] = [];

  if (!rangeExcludesBelow(pkg.manifest?.kernel ?? '', EXTENSION_STEPS_SINCE_KERNEL)) {
    issues.push({ message: '@core.marketplace/issue.extension-step.kernel', messageParams: { minimum: EXTENSION_STEPS_SINCE_KERNEL } });
  }

  const seen = new Set<string>();
  for (const contribution of contributions) {
    const metadata = (contribution.metadata ?? {}) as Record<string, unknown>;
    const key = text(metadata.key);
    const params = { step: key || contribution.id };
    if (!isExtensionStepKey(key)) {
      issues.push({ message: '@core.marketplace/issue.extension-step.key', messageParams: params });
      continue;
    }
    if (seen.has(key)) issues.push({ message: '@core.marketplace/issue.extension-step.duplicate', messageParams: params });
    seen.add(key);
    if (text(metadata.name) === '') issues.push({ message: '@core.marketplace/issue.extension-step.name', messageParams: params });
    if (text(metadata.icon) !== '' && !isScreenIconKey(text(metadata.icon))) {
      issues.push({ message: '@core.marketplace/issue.extension-step.icon', messageParams: { ...params, icon: text(metadata.icon) } });
    }

    const impl = contribution.impl;
    if (impl?.kind === 'workflow') {
      const body = (pkg.workflows ?? []).find((workflow) => workflow.templateId === text(impl.workflowId));
      if (!body) {
        issues.push({ message: '@core.marketplace/issue.extension-step.body-missing', messageParams: { ...params, body: text(impl.workflowId) } });
        continue;
      }
      if (body.eventName !== WORKFLOW_CALLED_EVENT) {
        issues.push({ message: '@core.marketplace/issue.extension-step.body-not-called', messageParams: { ...params, body: body.templateId } });
      }
      const pausing = pausingStepOf(body.steps ?? []);
      if (pausing) {
        issues.push({ message: '@core.marketplace/issue.extension-step.body-pauses', messageParams: { ...params, body: body.templateId, pausing: pausing.id } });
      }
    } else if (impl?.kind === 'script') {
      if (!(pkg.scripts ?? []).some((script) => script.templateId === text(impl.scriptId))) {
        issues.push({ message: '@core.marketplace/issue.extension-step.body-missing', messageParams: { ...params, body: text(impl.scriptId) } });
      }
    } else {
      issues.push({ message: '@core.marketplace/issue.extension-step.impl', messageParams: { ...params, kind: String(impl?.kind ?? '') } });
    }
  }
  return issues;
};
