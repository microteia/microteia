import type { IGmailConnectionRepository } from '../../repositories/IGmailConnectionRepository';
import type { GmailToken } from '../../entities';

export type UpdateGmailTokenUseCase = {
  execute: (
    tenantId: string,
    connectionId: string,
    tokenData: Omit<GmailToken, 'id' | 'connectionId' | 'tenantId'>,
  ) => Promise<void>;
};

export const makeUpdateGmailTokenUseCase = (repo: IGmailConnectionRepository): UpdateGmailTokenUseCase => ({
  execute: (tenantId, connectionId, tokenData) => repo.updateToken(tenantId, connectionId, tokenData),
});
