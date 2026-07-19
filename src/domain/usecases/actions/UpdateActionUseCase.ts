import type { ActionDefinitionInput, IActionRepository } from '../../repositories/IActionRepository';

export type UpdateActionUseCase = {
  execute: (tenantId: string, actionId: string, data: Partial<ActionDefinitionInput>) => Promise<void>;
};

export const makeUpdateActionUseCase = (repo: IActionRepository): UpdateActionUseCase => ({
  execute: (tenantId, actionId, data) => repo.update(tenantId, actionId, data),
});
