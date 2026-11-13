import { createContext, useContext } from 'react';
import type { HttpConnection } from '../domain/schema/httpConnection';
import type { HttpConnectionRequirement } from '../domain/schema/httpConnectionRequirement';
import type { SaveHttpConnectionInput, SaveHttpConnectionResult } from '../domain/usecases/httpconnections/SaveHttpConnectionUseCase';

export interface HttpConnectionsContextValue {
  connections: HttpConnection[];
  /**
   * A lista foi LIDA. Sem permissão para lê-la, ou antes de ela chegar, é `false` — e quem cobra uma
   * credencial que falta precisa da diferença: "não sei" não pode virar "falta".
   */
  known: boolean;
  isLoading: boolean;
  /** A leitura foi recusada ou falhou — quem tem a aba aberta precisa saber que a lista não é a real. */
  failed: boolean;
  save: (input: Omit<SaveHttpConnectionInput, 'tenantId' | 'existing'>) => Promise<SaveHttpConnectionResult>;
  remove: (id: string) => Promise<void>;
  /**
   * A credencial que uma extensão declarou e alguém pediu para cadastrar. A tela de Extensões a deixa
   * aqui e abre a aba de Credenciais, que a consome para abrir o formulário preenchido.
   */
  draft: HttpConnectionRequirement | null;
  requestDraft: (requirement: HttpConnectionRequirement) => void;
  clearDraft: () => void;
}

export const HttpConnectionsContext = createContext<HttpConnectionsContextValue | null>(null);

export const useHttpConnections = (): HttpConnectionsContextValue => {
  const ctx = useContext(HttpConnectionsContext);
  if (!ctx) throw new Error('useHttpConnections must be used within HttpConnectionStoreProvider');
  return ctx;
};
