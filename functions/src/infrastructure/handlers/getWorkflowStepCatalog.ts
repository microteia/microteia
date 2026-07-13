import { onCall } from 'firebase-functions/v2/https';
import { getDI } from '../di/container';
import { stepRegistry } from '../../domain/engine/StepRegistry';
import type { StepDefinition } from '../../domain/engine/StepDefinition';

/**
 * Tipo para o catálogo de Steps (sem o createExecutor, que não existe no front-end).
 */
type StepDefinitionSummary = Omit<StepDefinition, 'createExecutor'>;

/**
 * Cloud Function que retorna o catálogo de Steps disponíveis.
 * Não persiste no Firestore — retorna diretamente do registro em memória.
 * O front-end armazena em um Store para evitar múltiplas chamadas.
 */
export const getWorkflowStepCatalog = onCall(
  {
    region: 'southamerica-east1',
    cors: true
  },
  async () => {
    // Garante que os steps estão registrados (idempotente)
    await getDI().ensureWorkflowStepsRegistered();

    // Converte cada StepDefinition para StepDefinitionSummary
    // (remove apenas createExecutor, que não existe no tipo Summary)
    const steps: StepDefinitionSummary[] = stepRegistry.list().map((def) => ({
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

    return { steps };
  }
);
