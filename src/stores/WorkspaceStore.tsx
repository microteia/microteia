import React, { useReducer, useCallback } from 'react';
import { WorkspaceContext } from './useWorkspace';
import type { SplitDirection } from './useWorkspace';
import { initialWorkspaceState, workspaceReducer } from './workspaceReducer';

export const WorkspaceStoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(workspaceReducer, initialWorkspaceState);

  const openTab = useCallback((key: string) => dispatch({ type: 'OPEN_TAB', key }), []);
  const openTabs = useCallback((keys: string[]) => dispatch({ type: 'OPEN_TABS', keys }), []);
  const closeTab = useCallback((key: string, panelId: string) => dispatch({ type: 'CLOSE_TAB', key, panelId }), []);
  const closeOtherTabs = useCallback((keepKey: string, panelId: string) => dispatch({ type: 'CLOSE_OTHER_TABS', keepKey, panelId }), []);
  const activateTab = useCallback((key: string, panelId: string) => dispatch({ type: 'ACTIVATE_TAB', key, panelId }), []);
  const setActivePanelId = useCallback((panelId: string) => dispatch({ type: 'SET_ACTIVE_PANEL', panelId }), []);
  const closePanel = useCallback((panelId: string) => dispatch({ type: 'CLOSE_PANEL', panelId }), []);
  const splitPanel = useCallback((panelId: string, direction: SplitDirection) => dispatch({ type: 'SPLIT_PANEL', panelId, direction }), []);
  const updateSplitRatio = useCallback((splitId: string, ratio: number) => dispatch({ type: 'UPDATE_SPLIT_RATIO', splitId, ratio }), []);
  const setTabTitle = useCallback((key: string, title: string) => dispatch({ type: 'SET_TAB_TITLE', key, title }), []);

  return (
    <WorkspaceContext.Provider value={{
      panels: state.panels,
      layout: state.layout,
      activePanelId: state.activePanelId,
      tabTitleOverrides: state.tabTitleOverrides,
      openTab,
      openTabs,
      closeTab,
      closeOtherTabs,
      activateTab,
      setActivePanelId,
      closePanel,
      splitPanel,
      updateSplitRatio,
      setTabTitle,
    }}>
      {children}
    </WorkspaceContext.Provider>
  );
};
