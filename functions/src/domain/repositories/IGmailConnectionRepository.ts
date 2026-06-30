import type { GmailConnection } from '../entities/GmailConnection';

export interface IGmailConnectionRepository {
  getConnectionsByEmail(email: string): Promise<GmailConnection[]>;
}
