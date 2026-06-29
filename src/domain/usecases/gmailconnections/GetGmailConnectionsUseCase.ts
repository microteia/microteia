import type { IGmailConnectionRepository } from '../../repositories/IGmailConnectionRepository';
import type { GmailConnection } from '../../entities';

export type GetGmailConnectionsUseCase = {
  execute: (tenantId: string) => Promise<GmailConnection[]>;
};

export const makeGetGmailConnectionsUseCase = (repo: IGmailConnectionRepository): GetGmailConnectionsUseCase => ({
  execute: (tenantId) => repo.getConnections(tenantId),
});
