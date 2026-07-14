import type { IGmailConnectionRepository } from '../../repositories/IGmailConnectionRepository';
import type { GmailConnection, GmailToken } from '../../entities';

export interface CreateOrUpdateGmailConnectionData {
  email: string;
  scopes: string[];
  authorizedBy: string;
  authorizedByName: string;
  historyId?: string;
  expiration?: string;
}

export type CreateOrUpdateGmailConnectionUseCase = {
  execute: (
    tenantId: string,
    data: CreateOrUpdateGmailConnectionData,
    tokenData: Omit<GmailToken, 'id' | 'connectionId' | 'tenantId'>,
  ) => Promise<GmailConnection>;
};

export const makeCreateOrUpdateGmailConnectionUseCase = (
  repo: IGmailConnectionRepository,
): CreateOrUpdateGmailConnectionUseCase => ({
  execute: async (tenantId, data, tokenData) => {
    const existingConnections = await repo.getConnections(tenantId);
    const existing = existingConnections.find((c) => c.email === data.email);

    if (existing) {
      await repo.updateToken(tenantId, existing.id, tokenData);
      await repo.updateConnectionAuthorizedAt(tenantId, existing.id);
      
      if (data.historyId && data.expiration) {
        await repo.updateConnectionWatchData(tenantId, existing.id, data.historyId, data.expiration);
      }

      return {
        ...existing,
        authorizedAt: new Date(),
        expiration: data.expiration,
      };
    }

    return repo.createConnection(
      tenantId,
      {
        email: data.email,
        scopes: data.scopes,
        authorizedBy: data.authorizedBy,
        authorizedByName: data.authorizedByName,
        expiration: data.expiration,
      },
      tokenData,
    );
  },
});
