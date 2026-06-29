import type { AIConnection } from '../entities';

export interface IAIConnectionRepository {
  getConnections(tenantId: string): Promise<AIConnection[]>;
  createConnection(tenantId: string, data: Omit<AIConnection, 'id' | 'tenantId' | 'createdAt'>): Promise<AIConnection>;
  updateConnection(tenantId: string, id: string, data: Partial<Omit<AIConnection, 'id' | 'tenantId' | 'createdAt'>>): Promise<void>;
  deleteConnection(tenantId: string, id: string): Promise<void>;
  setDefault(tenantId: string, id: string): Promise<void>;
}
