import type { Script } from '../entities/Script';

export interface IScriptRepository {
  findById(tenantId: string, id: string): Promise<Script | null>;
}
