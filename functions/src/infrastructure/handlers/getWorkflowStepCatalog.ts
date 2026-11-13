import { onCall } from 'firebase-functions/v2/https';
import { getDI } from '../di/container';
import { stepRegistry } from '../../domain/engine/StepRegistry';
import type { StepDefinition } from '../../domain/engine/StepDefinition';
import { extensionStepCatalogEntry } from '../../domain/schema/workflowStepContribution';
import { isOfficeMember } from './shared/requirePermission';

/** O catálogo como o editor o lê: a entrada, sem o executor (que não existe no front). */
type StepDefinitionSummary = Omit<StepDefinition, 'createExecutor'>;

/**
 * O catálogo de passos: os do NÚCLEO, iguais para todo escritório, mais os que as extensões LIGADAS do
 * escritório declaram — o "conector". Por isso ele é por escritório: a mesma tela, em outro escritório,
 * oferece outros passos. Sem `tenantId` (ou para quem não é membro), só o núcleo.
 */
export const getWorkflowStepCatalog = onCall(
  { region: 'southamerica-east1', cors: true },
  async (request) => {
    await getDI().ensureWorkflowStepsRegistered();

    const core: StepDefinitionSummary[] = stepRegistry.list().map((def) => ({
      id: def.id,
      version: def.version,
      name: def.name,
      description: def.description,
      icon: def.icon,
      category: def.category,
      type: def.type,
      configurable: def.configurable,
      inputs: def.inputs,
      outputDefinitions: def.outputDefinitions,
      dynamicOutputs: def.dynamicOutputs,
      dynamicInputs: def.dynamicInputs,
    }));

    const tenantId = typeof request.data?.tenantId === 'string' ? request.data.tenantId : '';
    if (!tenantId || !request.auth || !(await isOfficeMember(tenantId, request.auth))) return { steps: core };

    const { steps } = await getDI().getInstalledExtensionCache().extensionSteps(tenantId);
    return { steps: [...core, ...steps.map(extensionStepCatalogEntry)] };
  },
);
