import { createContext, useContext } from 'react';

export const WORKSPACE_DOCK_MIN_WIDTH = 320;
export const WORKSPACE_DOCK_MAX_WIDTH = 760;
export const WORKSPACE_DOCK_DEFAULT_WIDTH = 400;

export interface WorkspaceDockContextValue {
  /**
   * O painel aberto, pela chave do trecho. `''` pede "o último, ou o primeiro disponível" — quem
   * abre pelo atalho não sabe que painéis existem; quem desenha o dock sabe.
   */
  openKey: string | null;
  /**
   * O dock já foi aberto nesta sessão. Daí em diante os painéis continuam montados, escondidos
   * quando ele fecha — uma conversa em andamento não pode morrer porque alguém fechou o painel.
   */
  everOpened: boolean;
  width: number;
  /**
   * Abre o painel. `intent` é um pedido ao PAINEL — "comece uma conversa nova" —, entregue a quem o
   * assina em `subscribeIntent`; se o painel ainda não montou, fica guardado até ele assinar.
   */
  open: (key: string, intent?: string) => void;
  subscribeIntent: (key: string, handler: (intent: string) => void) => () => void;
  /** Sem chave: fecha se aberto, ou reabre o último. Com chave: abre aquele, ou fecha se já é ele. */
  toggle: (key?: string) => void;
  close: () => void;
  /** A largura durante o arraste; `persist` grava a final. */
  setWidth: (width: number, persist?: boolean) => void;
}

export const WorkspaceDockContext = createContext<WorkspaceDockContextValue | null>(null);

export const useWorkspaceDock = (): WorkspaceDockContextValue => {
  const ctx = useContext(WorkspaceDockContext);
  if (!ctx) throw new Error('useWorkspaceDock must be used within WorkspaceDockProvider');
  return ctx;
};

export const clampDockWidth = (width: number): number =>
  Math.round(Math.min(WORKSPACE_DOCK_MAX_WIDTH, Math.max(WORKSPACE_DOCK_MIN_WIDTH, width)));
