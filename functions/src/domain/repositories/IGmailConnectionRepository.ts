import type { GmailConnection } from '../entities/GmailConnection';

export interface GmailToken {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}

/**
 * O que a autorização de uma conta grava. `authorizedAt` fica de fora porque quem o carimba é o
 * repositório: a hora da autorização é do servidor, não de quem a pediu.
 */
export interface GmailConnectionInput {
  tenantId: string;
  email: string;
  scopes: string[];
  authorizedBy: string;
  authorizedByName: string;
  historyId?: string;
  expiration?: string;
}

export interface IGmailConnectionRepository {
  getAllConnections(): Promise<GmailConnection[]>;
  getConnectionsByEmail(email: string): Promise<GmailConnection[]>;
  getConnectionsByTenant(tenantId: string): Promise<GmailConnection[]>;
  /**
   * Grava a conexão e o token na MESMA operação, criando quando a conta ainda não está autorizada
   * naquele escritório e atualizando quando já está — reautorizar é o caso normal, não exceção.
   */
  saveConnection(input: GmailConnectionInput, token: GmailToken): Promise<GmailConnection>;
  /** Apaga a conexão e o token dela. Token sem conexão seria credencial órfã e viva. */
  deleteConnection(connectionId: string): Promise<void>;
  getAccessToken(connectionId: string): Promise<GmailToken | null>;
  updateHistoryId(connectionId: string, historyId: string): Promise<void>;
  updateAccessToken(connectionId: string, accessToken: string, expiresAt: Date, refreshToken?: string): Promise<void>;
  updateExpiration(connectionId: string, expiration: string): Promise<void>;
}
