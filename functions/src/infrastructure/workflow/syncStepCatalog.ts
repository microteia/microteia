import type { Firestore } from 'firebase-admin/firestore';
import type { StepDefinition } from '../../domain/engine/StepDefinition';
import type { StepRegistry } from '../../domain/engine/StepRegistry';

const toCatalogEntry = (definition: StepDefinition) => ({
  id: definition.id,
  version: definition.version,
  name: definition.name,
  description: definition.description,
  icon: definition.icon,
  category: definition.category,
  configurable: definition.configurable,
  inputs: definition.inputs,
  outputDefinitions: definition.outputDefinitions,
});

/**
 * Espelha cada StepDefinition registrada (menos `createExecutor`, que não existe do lado
 * cliente) em `workflow_step_catalog/{stepDefinitionId}` — coleção global, não por tenant,
 * já que o catálogo de Steps disponíveis é o mesmo para todos os escritórios. `src/` só lê
 * essa coleção para alimentar o builder visual, nunca importa os executores.
 */
export const syncStepCatalog = async (db: Firestore, registry: StepRegistry): Promise<void> => {
  const batch = db.batch();
  for (const definition of registry.list()) {
    const ref = db.collection('workflow_step_catalog').doc(definition.id);
    batch.set(ref, toCatalogEntry(definition), { merge: true });
  }
  await batch.commit();
};
