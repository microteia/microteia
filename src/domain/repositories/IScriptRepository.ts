import type { Script } from '../entities/Script';

export interface IScriptRepository {
  getScripts(tenantId: string): Promise<Script[]>;
  subscribeToScripts(tenantId: string, onUpdate: (scripts: Script[]) => void): () => void;
  getScriptById(tenantId: string, id: string): Promise<Script | null>;
  createScript(
    tenantId: string,
    data: Omit<Script, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>,
  ): Promise<Script>;
  updateScript(
    tenantId: string,
    id: string,
    data: Partial<Omit<Script, 'id' | 'tenantId' | 'createdAt'>>,
  ): Promise<void>;
  deleteScript(tenantId: string, id: string): Promise<void>;
}
