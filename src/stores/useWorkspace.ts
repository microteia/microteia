import { createContext, useContext } from 'react';
import type { WorkspaceSnapshot } from './workspaceReducer';

export type SplitDirection = 'horizontal' | 'vertical';

export interface WorkspacePanel {
  id: string;
  tabKeys: string[];
  activeTabKey: string | null;
}

export type PanelLeaf = { type: 'panel'; panelId: string };
export type PanelSplit = {
  type: 'split';
  id: string;
  direction: SplitDirection;
  ratio: number;
  first: PanelNode;
  second: PanelNode;
};
export type PanelNode = PanelLeaf | PanelSplit;

export interface WorkspaceContextValue {
  panels: Record<string, WorkspacePanel>;
  layout: PanelNode;
  activePanelId: string;
  tabTitleOverrides: Record<string, string>;
  /** A abertura deste escritório já foi decidida (sessão restaurada ou telas iniciais) — ver `hydrate`. */
  hydrated: boolean;
  openTab: (key: string) => void;
  /**
   * Abre várias abas de uma vez e ativa a PRIMEIRA. Existe porque `openTab` em sequência ativaria a
   * última — e a primeira é a que a ordem declarada põe na frente (as telas iniciais, #14).
   */
  openTabs: (keys: string[]) => void;
  closeTab: (key: string, panelId: string) => void;
  closeOtherTabs: (keepKey: string, panelId: string) => void;
  activateTab: (key: string, panelId: string) => void;
  setActivePanelId: (id: string) => void;
  closePanel: (panelId: string) => void;
  splitPanel: (panelId: string, direction: SplitDirection) => void;
  updateSplitRatio: (splitId: string, ratio: number) => void;
  setTabTitle: (key: string, title: string) => void;
  /** A sessão guardada da última vez neste escritório, já validada — ainda sem o filtro de permissão. */
  loadSavedSession: () => WorkspaceSnapshot | null;
  /**
   * Decide a abertura do escritório, uma vez por entrada: reabre `snapshot` ou, sem ele, abre `homeKeys`.
   * `persist` diz se a sessão passa a ser gravada a partir daí (a escolha da pessoa, #15).
   * O filtro (página que sumiu, que deixou de ser permitida) é de quem chama, porque depende das
   * contribuições e da autorização, que este store não conhece.
   */
  hydrate: (snapshot: WorkspaceSnapshot | null, homeKeys: string[], persist: boolean) => void;
  /** Liga ou desliga a gravação da sessão neste escritório; desligar apaga o que estava guardado. */
  setPersist: (persist: boolean) => void;
}

export const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export const useWorkspace = (): WorkspaceContextValue => {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error('useWorkspace must be used within WorkspaceStoreProvider');
  return ctx;
};
