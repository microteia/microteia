import type { AICredentials } from '../entities/AICredentials';

export interface IAIConnectionRepository {
  getDefaultCredentials(tenantId: string): Promise<AICredentials>;
}
