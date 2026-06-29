import type { IGmailConnectionRepository } from '../../repositories/IGmailConnectionRepository';

export type UpdateGmailConnectionAuthorizedAtUseCase = {
  execute: (tenantId: string, connectionId: string) => Promise<void>;
};

export const makeUpdateGmailConnectionAuthorizedAtUseCase = (
  repo: IGmailConnectionRepository,
): UpdateGmailConnectionAuthorizedAtUseCase => ({
  execute: (tenantId, connectionId) => repo.updateConnectionAuthorizedAt(tenantId, connectionId),
});
