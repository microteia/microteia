import { createContext, useContext } from 'react';

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
  openTab: (key: string) => void;
  closeTab: (key: string, panelId: string) => void;
  closeOtherTabs: (keepKey: string, panelId: string) => void;
  activateTab: (key: string, panelId: string) => void;
  setActivePanelId: (id: string) => void;
  splitPanel: (panelId: string, direction: SplitDirection) => void;
  updateSplitRatio: (splitId: string, ratio: number) => void;
  setTabTitle: (key: string, title: string) => void;
}

export const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export const useWorkspace = (): WorkspaceContextValue => {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error('useWorkspace must be used within WorkspaceStoreProvider');
  return ctx;
};
