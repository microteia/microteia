import type { AICredentials } from '../entities/AICredentials';

export interface AICallOptions {
  systemPrompt?: string;
  expectJson?: boolean;
  jsonSchema?: { name: string; schema: Record<string, unknown> };
}

export interface IAIProviderService {
  canHandle(provider: string): boolean;
  call(credentials: AICredentials, prompt: string, options?: AICallOptions): Promise<string>;
}
