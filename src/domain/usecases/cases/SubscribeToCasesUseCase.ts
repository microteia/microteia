import type { Case } from '../../entities';
import type { ICaseRepository } from '../../repositories/ICaseRepository';

export type SubscribeToCasesUseCase = {
  execute: (tenantId: string, onUpdate: (cases: Case[]) => void) => () => void;
};

export const makeSubscribeToCasesUseCase = (repo: ICaseRepository): SubscribeToCasesUseCase => ({
  execute: (tenantId, onUpdate) => repo.subscribeToCases(tenantId, onUpdate),
});
