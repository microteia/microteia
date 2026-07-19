import type { ActionDefinition } from '../../entities';
import type { IActionRepository } from '../../repositories/IActionRepository';

export type GetActionsUseCase = {
  execute: (tenantId: string) => Promise<ActionDefinition[]>;
};

export const makeGetActionsUseCase = (repo: IActionRepository): GetActionsUseCase => ({
  execute: (tenantId) => repo.getAll(tenantId),
});
