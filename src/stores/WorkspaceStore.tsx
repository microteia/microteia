import React, { useReducer, useCallback, useEffect, useMemo } from 'react';
import { WorkspaceContext } from './useWorkspace';
import type { SplitDirection } from './useWorkspace';
import { useAuth } from './useAuth';
import { useTenant } from './useTenant';
import {
  emptyWorkspaceSession,
  workspaceSessionReducer,
  type WorkspaceAction,
  type WorkspaceSnapshot,
} from './workspaceReducer';
import { loadWorkspaceSession, saveWorkspaceSession, workspaceSessionScope } from './workspaceSession';

export const WorkspaceStoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const scope = workspaceSessionScope(user?.id, currentTenant?.id);
  const [state, dispatch] = useReducer(workspaceSessionReducer, scope, emptyWorkspaceSession);

  // Trocou o escritório: até a primeira ação do novo escopo, o que vale é o espaço vazio dele — nada
  // do anterior chega a ser desenhado, nem por um render.
  const emptySession = useMemo(() => emptyWorkspaceSession(scope), [scope]);
  const session = state.scope === scope ? state : emptySession;
  const { workspace } = session;

  useEffect(() => {
    if (!session.scope || !session.hydrated || !session.persist) return;
    saveWorkspaceSession(session.scope, session.workspace);
  }, [session]);

  const act = useCallback((action: WorkspaceAction) => dispatch({ ...action, scope }), [scope]);

  const openTab = useCallback((key: string) => act({ type: 'OPEN_TAB', key }), [act]);
  const openTabs = useCallback((keys: string[]) => act({ type: 'OPEN_TABS', keys }), [act]);
  const closeTab = useCallback((key: string, panelId: string) => act({ type: 'CLOSE_TAB', key, panelId }), [act]);
  const closeOtherTabs = useCallback((keepKey: string, panelId: string) => act({ type: 'CLOSE_OTHER_TABS', keepKey, panelId }), [act]);
  const activateTab = useCallback((key: string, panelId: string) => act({ type: 'ACTIVATE_TAB', key, panelId }), [act]);
  const setActivePanelId = useCallback((panelId: string) => act({ type: 'SET_ACTIVE_PANEL', panelId }), [act]);
  const closePanel = useCallback((panelId: string) => act({ type: 'CLOSE_PANEL', panelId }), [act]);
  const splitPanel = useCallback((panelId: string, direction: SplitDirection) => act({ type: 'SPLIT_PANEL', panelId, direction }), [act]);
  const updateSplitRatio = useCallback((splitId: string, ratio: number) => act({ type: 'UPDATE_SPLIT_RATIO', splitId, ratio }), [act]);
  const setTabTitle = useCallback((key: string, title: string) => act({ type: 'SET_TAB_TITLE', key, title }), [act]);

  const loadSavedSession = useCallback(() => (scope ? loadWorkspaceSession(scope) : null), [scope]);
  const hydrate = useCallback(
    (snapshot: WorkspaceSnapshot | null, homeKeys: string[]) =>
      dispatch({ type: 'HYDRATE', snapshot, homeKeys, persist: true, scope }),
    [scope],
  );

  return (
    <WorkspaceContext.Provider value={{
      panels: workspace.panels,
      layout: workspace.layout,
      activePanelId: workspace.activePanelId,
      tabTitleOverrides: workspace.tabTitleOverrides,
      hydrated: session.hydrated,
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
      loadSavedSession,
      hydrate,
    }}>
      {children}
    </WorkspaceContext.Provider>
  );
};
