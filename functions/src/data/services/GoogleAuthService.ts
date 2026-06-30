import type { IGmailAuthService, RefreshedTokens } from '../../domain/repositories/IGmailAuthService';
import type { GmailTokens, GmailAuthConfig } from '../../domain/entities/GmailTokens';

export class GoogleAuthService implements IGmailAuthService {
  async exchangeCode(code: string, config: GmailAuthConfig): Promise<GmailTokens> {
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uri: config.redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      const error = await tokenResponse.json().catch(() => ({})) as Record<string, unknown>;
      throw new Error(`Erro ao trocar código: ${JSON.stringify(error)}`);
    }

    const tokens = await tokenResponse.json() as {
      access_token: string;
      refresh_token?: string;
      expires_in: number;
      scope: string;
    };

    if (!tokens.access_token) {
      throw new Error('Token de acesso não retornado pelo Google.');
    }

    const profileResponse = await fetch('https://www.googleapis.com/gmail/v1/users/me/profile', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });

    if (!profileResponse.ok) {
      throw new Error('Erro ao buscar perfil Gmail.');
    }

    const profileData = await profileResponse.json() as { emailAddress?: string };

    return {
      email: profileData.emailAddress ?? 'desconhecido',
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token ?? '',
      expiresIn: tokens.expires_in,
      scopes: tokens.scope.split(' '),
    };
  }

  async refreshAccessToken(refreshToken: string, config: GmailAuthConfig): Promise<RefreshedTokens> {
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        refresh_token: refreshToken,
        client_id: config.clientId,
        client_secret: config.clientSecret,
        grant_type: 'refresh_token',
      }),
    });

    if (!tokenResponse.ok) {
      const error = await tokenResponse.json().catch(() => ({})) as Record<string, unknown>;
      throw new Error(`Erro ao renovar token: ${JSON.stringify(error)}`);
    }

    const tokens = await tokenResponse.json() as {
      access_token: string;
      expires_in: number;
      refresh_token?: string;
    };

    if (!tokens.access_token) {
      throw new Error('Token de acesso não retornado ao renovar.');
    }

    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    return {
      accessToken: tokens.access_token,
      expiresAt,
      refreshToken: tokens.refresh_token,
    };
  }
}
