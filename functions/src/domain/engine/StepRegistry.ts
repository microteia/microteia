import type { StepDefinition } from './StepDefinition';

export interface StepRegistry {
  register(definition: StepDefinition): void;
  resolve(stepDefinitionId: string): StepDefinition | undefined;
  list(): StepDefinition[];
}

class StepRegistryImpl implements StepRegistry {
  private definitions: Map<string, StepDefinition> = new Map();

  register(definition: StepDefinition): void {
    this.definitions.set(definition.id, definition);
  }

  resolve(stepDefinitionId: string): StepDefinition | undefined {
    return this.definitions.get(stepDefinitionId);
  }

  list(): StepDefinition[] {
    return Array.from(this.definitions.values());
  }
}

export const stepRegistry: StepRegistry = new StepRegistryImpl();
