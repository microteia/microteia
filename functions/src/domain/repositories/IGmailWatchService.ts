import type { GmailWatchResult } from '../entities/GmailWatchResult';
import type { GmailAuthConfig } from '../entities/GmailTokens';

export interface IGmailWatchService {
  registerWatch(
    accessToken: string,
    topicName: string,
    config: GmailAuthConfig,
  ): Promise<GmailWatchResult>;
}
