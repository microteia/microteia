import type { AICredentials } from '../entities/AICredentials';

export interface IAIConnectionRepository {
  getDefaultCredentials(tenantId: string): Promise<AICredentials>;
  getAllCredentials(tenantId: string): Promise<AICredentials[]>;
  getCredentialsById(tenantId: string, connectionId: string): Promise<AICredentials>;
}
