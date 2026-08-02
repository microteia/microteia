import type { Script } from '../entities/Script';
import type { WorkflowParameter } from '../entities/Workflow';

export interface ScriptRunLogEntry {
  level: 'INFO' | 'WARN' | 'ERROR';
  message: string;
}

export interface RunScriptInput {
  tenantId: string;
  compiledJs: string;
  inputParams: WorkflowParameter[];
  providedParams?: Record<string, unknown>;
}

export interface RunScriptResult {
  outputs: Record<string, unknown> | null;
  logs: ScriptRunLogEntry[];
  error: string | null;
}

export interface IScriptRepository {
  runScript(input: RunScriptInput): Promise<RunScriptResult>;
  getScripts(tenantId: string): Promise<Script[]>;
  subscribeToScripts(tenantId: string, onUpdate: (scripts: Script[]) => void): () => void;
  getScriptById(tenantId: string, id: string): Promise<Script | null>;
  /** `id` é o IDENTIFICADOR escolhido. Ver `IActionRepository.create`. */
  createScript(
    tenantId: string,
    data: Omit<Script, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>,
    id?: string,
  ): Promise<Script>;
  updateScript(
    tenantId: string,
    id: string,
    data: Partial<Omit<Script, 'id' | 'tenantId' | 'createdAt'>>,
  ): Promise<void>;
  deleteScript(tenantId: string, id: string): Promise<void>;
}
