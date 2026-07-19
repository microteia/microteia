import type { ActionDefinition } from '../../entities';
import type { IActionRepository } from '../../repositories/IActionRepository';

export type SubscribeToActionsUseCase = {
  execute: (tenantId: string, onUpdate: (actions: ActionDefinition[]) => void) => () => void;
};

export const makeSubscribeToActionsUseCase = (repo: IActionRepository): SubscribeToActionsUseCase => ({
  execute: (tenantId, onUpdate) => repo.subscribeToActions(tenantId, onUpdate),
});
