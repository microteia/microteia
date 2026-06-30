import { google } from 'googleapis';
import type { IGmailWatchService } from '../../domain/repositories/IGmailWatchService';
import type { GmailWatchResult } from '../../domain/entities/GmailWatchResult';
import type { GmailAuthConfig } from '../../domain/entities/GmailTokens';

export class GmailWatchService implements IGmailWatchService {
  async registerWatch(
    accessToken: string,
    topicName: string,
    config: GmailAuthConfig,
  ): Promise<GmailWatchResult> {
    const oauth2Client = new google.auth.OAuth2(
      config.clientId,
      config.clientSecret,
      config.redirectUri,
    );

    oauth2Client.setCredentials({ access_token: accessToken });

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    try {
      const response = await gmail.users.watch({
        userId: 'me',
        requestBody: {
          topicName,
          labelIds: ['INBOX'],
        },
      });

      if (!response.data.historyId || !response.data.expiration) {
        throw new Error('Resposta do Gmail Watch inválida: historyId ou expiration ausentes.');
      }

      return {
        historyId: response.data.historyId,
        expiration: response.data.expiration.toString(),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro desconhecido ao registrar Gmail Watch.';
      throw new Error(`Falha ao registrar Gmail Push Notifications: ${message}`, { cause: error });
    }
  }
}
