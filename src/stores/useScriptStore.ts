import { createContext, useContext } from 'react';
import type { Script } from '../domain/entities/Script';

export interface ScriptStoreContextValue {
  scripts: Script[];
  isLoading: boolean;
  createScript: (data: Omit<Script, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>) => Promise<Script>;
  updateScript: (id: string, data: Partial<Omit<Script, 'id' | 'tenantId' | 'createdAt'>>) => Promise<void>;
  deleteScript: (id: string) => Promise<void>;
}

export const ScriptStoreContext = createContext<ScriptStoreContextValue | null>(null);

export const useScriptStore = (): ScriptStoreContextValue => {
  const ctx = useContext(ScriptStoreContext);
  if (!ctx) throw new Error('useScriptStore must be used within ScriptStoreProvider');
  return ctx;
};
