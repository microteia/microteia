import type { GmailTokens, GmailAuthConfig } from '../entities/GmailTokens';

export interface RefreshedTokens {
  accessToken: string;
  expiresAt: Date;
  refreshToken?: string;
}

export interface IGmailAuthService {
  exchangeCode(code: string, config: GmailAuthConfig): Promise<GmailTokens>;
  refreshAccessToken(refreshToken: string, config: GmailAuthConfig): Promise<RefreshedTokens>;
}
