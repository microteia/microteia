import type { AICredentials } from '../entities/AICredentials';

export interface IAIProviderService {
  canHandle(provider: string): boolean;
  call(credentials: AICredentials, prompt: string): Promise<string>;
}
