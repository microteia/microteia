import type { ActionDefinition } from '../../entities';
import type { ActionDefinitionInput, IActionRepository } from '../../repositories/IActionRepository';

export type CreateActionUseCase = {
  execute: (tenantId: string, data: ActionDefinitionInput) => Promise<ActionDefinition>;
};

export const makeCreateActionUseCase = (repo: IActionRepository): CreateActionUseCase => ({
  execute: (tenantId, data) => repo.create(tenantId, data),
});
