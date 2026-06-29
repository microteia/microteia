import type { Provider } from './Provider';

export interface AICredentials {
  provider: Provider;
  apiKey: string;
  model: string;
  temperature: number;
  maxTokens: number;
}
