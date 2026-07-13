import type { AIConnection } from '../entities';

export type AIConnectionData = Omit<AIConnection, 'id' | 'tenantId' | 'createdAt' | 'hasApiKey'>;

export interface IAIConnectionRepository {
  getConnections(tenantId: string): Promise<AIConnection[]>;
  createConnection(tenantId: string, data: AIConnectionData, apiKey: string): Promise<AIConnection>;
  updateConnection(tenantId: string, id: string, data: Partial<AIConnectionData>, apiKey?: string): Promise<void>;
  deleteConnection(tenantId: string, id: string): Promise<void>;
  setDefault(tenantId: string, id: string): Promise<void>;
}
