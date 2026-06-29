import type { GmailConnection, GmailToken } from '../entities';

export interface IGmailConnectionRepository {
  getConnections(tenantId: string): Promise<GmailConnection[]>;
  createConnection(
    tenantId: string,
    data: Omit<GmailConnection, 'id' | 'tenantId' | 'authorizedAt'>,
    tokenData: Omit<GmailToken, 'id' | 'connectionId' | 'tenantId'>,
  ): Promise<GmailConnection>;
  deleteConnection(tenantId: string, connectionId: string): Promise<void>;
  updateToken(
    tenantId: string,
    connectionId: string,
    tokenData: Omit<GmailToken, 'id' | 'connectionId' | 'tenantId'>,
  ): Promise<void>;
  updateConnectionAuthorizedAt(tenantId: string, connectionId: string): Promise<void>;
}
