import type { IGmailConnectionRepository } from '../../repositories/IGmailConnectionRepository';
import type { GmailConnection, GmailToken } from '../../entities';

export type CreateGmailConnectionUseCase = {
  execute: (
    tenantId: string,
    data: Omit<GmailConnection, 'id' | 'tenantId' | 'authorizedAt'>,
    tokenData: Omit<GmailToken, 'id' | 'connectionId' | 'tenantId'>,
  ) => Promise<GmailConnection>;
};

export const makeCreateGmailConnectionUseCase = (repo: IGmailConnectionRepository): CreateGmailConnectionUseCase => ({
  execute: (tenantId, data, tokenData) => repo.createConnection(tenantId, data, tokenData),
});
