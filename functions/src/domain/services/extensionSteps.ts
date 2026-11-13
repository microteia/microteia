import type { StepDefinition, WorkflowStepExecutor } from '../engine/StepDefinition';
import { extensionStepCatalogEntry, parseExtensionStepId } from '../schema/workflowStepContribution';
import type { ExtensionStep } from '../schema/workflowStepContribution';

/** O passo de extensão resolvido — ou o motivo, por REFERÊNCIA, de ele não existir para este escritório. */
export type ExtensionStepResolution =
  | { ok: true; definition: StepDefinition }
  | { ok: false; error: string; errorParams: Record<string, string> };

export interface ExtensionStepResolverDeps {
  stepsOf(tenantId: string): Promise<{ steps: ExtensionStep[]; installed: ReadonlySet<string>; deactivated: ReadonlySet<string> }>;
  /** Os passos do núcleo — o corpo de um passo de extensão roda pelo executor de "Chamar automação" ou "Script". */
  core: { resolve(id: string): StepDefinition | undefined };
}

/**
 * O passo que o núcleo não conhece, procurado nas extensões do escritório. `null` quando o id nem é de
 * passo de extensão (o núcleo responde por ele).
 *
 * O corpo roda pelo executor que o núcleo já tem: a automação, por "Chamar automação" ESPERANDO o
 * resultado — no mesmo processo, com o mesmo ator, o mesmo prazo e a mesma conta de profundidade —; o
 * script, pelo sandbox. O alvo é sempre o do PACOTE: a entrada semeada pelo editor é ignorada, e editar a
 * automação à mão não aponta o passo para outro lugar.
 *
 * A extensão desligada e a ausente são motivos DIFERENTES, e o histórico diz qual: "passo desconhecido"
 * mandaria procurar um erro de digitação onde falta instalar ou religar uma extensão.
 */
export const makeExtensionStepResolver = (deps: ExtensionStepResolverDeps) =>
  async (stepDefinitionId: string, tenantId: string): Promise<ExtensionStepResolution | null> => {
    const parsed = parseExtensionStepId(stepDefinitionId);
    if (!parsed) return null;
    const { steps, installed, deactivated } = await deps.stepsOf(tenantId);
    const params = { extension: parsed.pluginId, step: stepDefinitionId };
    if (deactivated.has(parsed.pluginId)) return { ok: false, error: '@core.automation/step.extension.inactive', errorParams: params };
    const step = steps.find((one) => one.id === stepDefinitionId);
    if (!step) {
      return {
        ok: false,
        error: installed.has(parsed.pluginId) ? '@core.automation/step.extension.unknown-step' : '@core.automation/step.extension.missing',
        errorParams: params,
      };
    }
    const base = deps.core.resolve(step.body.kind === 'workflow' ? 'call-workflow' : 'script');
    if (!base) return { ok: false, error: '@core.automation/step.extension.unavailable', errorParams: params };

    const body = step.body;
    const createExecutor = (): WorkflowStepExecutor => {
      const delegate = base.createExecutor();
      return {
        execute: (_inputs, context) => delegate.execute(
          body.kind === 'workflow' ? { targetWorkflowId: body.ref, waitForResult: true } : { scriptId: body.ref },
          context,
        ),
      };
    };
    return { ok: true, definition: { ...extensionStepCatalogEntry(step), createExecutor } };
  };
