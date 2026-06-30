import type { GmailConnection } from '../entities/GmailConnection';

export interface GmailToken {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}

export interface IGmailConnectionRepository {
  getConnectionsByEmail(email: string): Promise<GmailConnection[]>;
  getAccessToken(connectionId: string): Promise<GmailToken | null>;
  updateHistoryId(connectionId: string, historyId: string): Promise<void>;
}
