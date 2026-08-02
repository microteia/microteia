import type { ActionDefinition } from '../../entities';
import type { ActionDefinitionInput, IActionRepository } from '../../repositories/IActionRepository';

export type CreateActionUseCase = {
  execute: (tenantId: string, data: ActionDefinitionInput, id?: string) => Promise<ActionDefinition>;
};

export const makeCreateActionUseCase = (repo: IActionRepository): CreateActionUseCase => ({
  execute: (tenantId, data, id) => repo.create(tenantId, data, id),
});
