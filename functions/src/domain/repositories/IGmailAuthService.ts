import type { GmailTokens, GmailAuthConfig } from '../entities/GmailTokens';

export interface IGmailAuthService {
  exchangeCode(code: string, config: GmailAuthConfig): Promise<GmailTokens>;
}
