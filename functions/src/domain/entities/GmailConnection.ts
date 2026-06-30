export interface GmailConnection {
  id: string;
  tenantId: string;
  email: string;
  scopes: string[];
  authorizedBy: string;
  authorizedByName: string;
  authorizedAt: Date;
  historyId?: string;
  expiration?: string;
}
