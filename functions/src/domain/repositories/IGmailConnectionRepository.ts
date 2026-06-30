import type { GmailConnection } from '../entities/GmailConnection';

export interface GmailToken {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}

export interface IGmailConnectionRepository {
  getAllConnections(): Promise<GmailConnection[]>;
  getConnectionsByEmail(email: string): Promise<GmailConnection[]>;
  getAccessToken(connectionId: string): Promise<GmailToken | null>;
  updateHistoryId(connectionId: string, historyId: string): Promise<void>;
  updateAccessToken(connectionId: string, accessToken: string, expiresAt: Date, refreshToken?: string): Promise<void>;
  updateExpiration(connectionId: string, expiration: string): Promise<void>;
}
