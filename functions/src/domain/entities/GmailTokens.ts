export interface GmailTokens {
  email: string;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  scopes: string[];
  historyId?: string;
  expiration?: string;
}

export interface GmailAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}
