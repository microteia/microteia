import type { IGmailConnectionRepository } from '../../repositories/IGmailConnectionRepository';

export type DeleteGmailConnectionUseCase = {
  execute: (tenantId: string, connectionId: string) => Promise<void>;
};

export const makeDeleteGmailConnectionUseCase = (repo: IGmailConnectionRepository): DeleteGmailConnectionUseCase => ({
  execute: (tenantId, connectionId) => repo.deleteConnection(tenantId, connectionId),
});
