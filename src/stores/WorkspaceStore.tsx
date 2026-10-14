import React, { useReducer, useCallback } from 'react';
import { WorkspaceContext } from './useWorkspace';
import type { WorkspacePanel, PanelNode, SplitDirection } from './useWorkspace';

let _counter = 0;
const genId = (prefix: string) => `${prefix}_${Date.now()}_${_counter++}`;

const ROOT_PANEL_ID = 'root';

interface WorkspaceState {
  panels: Record<string, WorkspacePanel>;
  layout: PanelNode;
  activePanelId: string;
  tabTitleOverrides: Record<string, string>;
}

type WorkspaceAction =
  | { type: 'OPEN_TAB'; key: string }
  | { type: 'CLOSE_TAB'; key: string; panelId: string }
  | { type: 'CLOSE_OTHER_TABS'; keepKey: string; panelId: string }
  | { type: 'ACTIVATE_TAB'; key: string; panelId: string }
  | { type: 'SET_ACTIVE_PANEL'; panelId: string }
  | { type: 'CLOSE_PANEL'; panelId: string }
  | { type: 'SPLIT_PANEL'; panelId: string; direction: SplitDirection }
  | { type: 'UPDATE_SPLIT_RATIO'; splitId: string; ratio: number }
  | { type: 'SET_TAB_TITLE'; key: string; title: string };

const findPanelForTab = (key: string, panels: Record<string, WorkspacePanel>): string | null => {
  for (const [id, panel] of Object.entries(panels)) {
    if (panel.tabKeys.includes(key)) return id;
  }
  return null;
};

const replacePanelInLayout = (node: PanelNode, targetId: string, replacement: PanelNode): PanelNode => {
  if (node.type === 'panel') return node.panelId === targetId ? replacement : node;
  return {
    ...node,
    first: replacePanelInLayout(node.first, targetId, replacement),
    second: replacePanelInLayout(node.second, targetId, replacement),
  };
};

const removePanelFromLayout = (node: PanelNode, targetId: string): PanelNode | null => {
  if (node.type === 'panel') return node.panelId === targetId ? null : node;
  if (node.first.type === 'panel' && node.first.panelId === targetId) return node.second;
  if (node.second.type === 'panel' && node.second.panelId === targetId) return node.first;
  const newFirst = removePanelFromLayout(node.first, targetId);
  const newSecond = removePanelFromLayout(node.second, targetId);
  if (!newFirst) return newSecond;
  if (!newSecond) return newFirst;
  return { ...node, first: newFirst, second: newSecond };
};

const updateRatioInLayout = (node: PanelNode, splitId: string, ratio: number): PanelNode => {
  if (node.type === 'panel') return node;
  if (node.id === splitId) return { ...node, ratio };
  return {
    ...node,
    first: updateRatioInLayout(node.first, splitId, ratio),
    second: updateRatioInLayout(node.second, splitId, ratio),
  };
};

const findNewActivePanelId = (panels: Record<string, WorkspacePanel>, excludeId: string): string => {
  const ids = Object.keys(panels).filter(id => id !== excludeId);
  return ids[0] ?? ROOT_PANEL_ID;
};

function workspaceReducer(state: WorkspaceState, action: WorkspaceAction): WorkspaceState {
  switch (action.type) {
    case 'OPEN_TAB': {
      const existingPanelId = findPanelForTab(action.key, state.panels);
      if (existingPanelId) {
        return {
          ...state,
          activePanelId: existingPanelId,
          panels: {
            ...state.panels,
            [existingPanelId]: { ...state.panels[existingPanelId], activeTabKey: action.key },
          },
        };
      }
      const targetPanelId = state.activePanelId;
      const panel = state.panels[targetPanelId];
      if (!panel) return state;
      return {
        ...state,
        panels: {
          ...state.panels,
          [targetPanelId]: {
            ...panel,
            tabKeys: [...panel.tabKeys, action.key],
            activeTabKey: action.key,
          },
        },
      };
    }

    case 'CLOSE_TAB': {
      const panel = state.panels[action.panelId];
      if (!panel) return state;
      const idx = panel.tabKeys.indexOf(action.key);
      const newTabKeys = panel.tabKeys.filter(k => k !== action.key);
      const wasActive = panel.activeTabKey === action.key;
      const newActiveTabKey = wasActive
        ? newTabKeys[Math.max(0, idx - 1)] ?? newTabKeys[0] ?? null
        : panel.activeTabKey;

      const updatedPanel = { ...panel, tabKeys: newTabKeys, activeTabKey: newActiveTabKey };
      const newPanels = { ...state.panels, [action.panelId]: updatedPanel };
      // eslint-disable-next-line @typescript-eslint/no-unused-vars -- destructuring to omit the closed tab's title override
      const { [action.key]: _removed, ...remainingOverrides } = state.tabTitleOverrides;

      if (newTabKeys.length === 0 && Object.keys(newPanels).length > 1) {
        const newLayout = removePanelFromLayout(state.layout, action.panelId);
        if (newLayout) {
          const remainingPanels = { ...newPanels };
          delete remainingPanels[action.panelId];
          return {
            panels: remainingPanels,
            layout: newLayout,
            activePanelId: state.activePanelId === action.panelId
              ? findNewActivePanelId(remainingPanels, action.panelId)
              : state.activePanelId,
            tabTitleOverrides: remainingOverrides,
          };
        }
      }

      return { ...state, panels: newPanels, tabTitleOverrides: remainingOverrides };
    }

    case 'CLOSE_OTHER_TABS': {
      const panel = state.panels[action.panelId];
      if (!panel || !panel.tabKeys.includes(action.keepKey)) return state;
      return {
        ...state,
        panels: {
          ...state.panels,
          [action.panelId]: { ...panel, tabKeys: [action.keepKey], activeTabKey: action.keepKey },
        },
      };
    }

    case 'ACTIVATE_TAB': {
      const panel = state.panels[action.panelId];
      if (!panel) return state;
      return {
        ...state,
        activePanelId: action.panelId,
        panels: { ...state.panels, [action.panelId]: { ...panel, activeTabKey: action.key } },
      };
    }

    case 'SET_ACTIVE_PANEL':
      return { ...state, activePanelId: action.panelId };

    case 'CLOSE_PANEL': {
      if (Object.keys(state.panels).length <= 1) return state;
      const newLayout = removePanelFromLayout(state.layout, action.panelId);
      if (!newLayout) return state;

      const removedPanel = state.panels[action.panelId];
      const remainingPanels = { ...state.panels };
      delete remainingPanels[action.panelId];

      const remainingOverrides = { ...state.tabTitleOverrides };
      for (const key of removedPanel?.tabKeys ?? []) delete remainingOverrides[key];

      return {
        panels: remainingPanels,
        layout: newLayout,
        activePanelId: state.activePanelId === action.panelId
          ? findNewActivePanelId(remainingPanels, action.panelId)
          : state.activePanelId,
        tabTitleOverrides: remainingOverrides,
      };
    }

    case 'SPLIT_PANEL': {
      const sourcePanel = state.panels[action.panelId];
      if (!sourcePanel) return state;
      const newPanelId = genId('panel');
      const newSplitId = genId('split');
      const newPanel: WorkspacePanel = { id: newPanelId, tabKeys: [], activeTabKey: null };
      const splitNode: PanelNode = {
        type: 'split',
        id: newSplitId,
        direction: action.direction,
        ratio: 0.5,
        first: { type: 'panel', panelId: action.panelId },
        second: { type: 'panel', panelId: newPanelId },
      };
      return {
        activePanelId: newPanelId,
        panels: { ...state.panels, [newPanelId]: newPanel },
        layout: replacePanelInLayout(state.layout, action.panelId, splitNode),
        tabTitleOverrides: state.tabTitleOverrides,
      };
    }

    case 'UPDATE_SPLIT_RATIO':
      return { ...state, layout: updateRatioInLayout(state.layout, action.splitId, action.ratio) };

    case 'SET_TAB_TITLE':
      return { ...state, tabTitleOverrides: { ...state.tabTitleOverrides, [action.key]: action.title } };

    default:
      return state;
  }
}

const initialState: WorkspaceState = {
  panels: { [ROOT_PANEL_ID]: { id: ROOT_PANEL_ID, tabKeys: [], activeTabKey: null } },
  layout: { type: 'panel', panelId: ROOT_PANEL_ID },
  activePanelId: ROOT_PANEL_ID,
  tabTitleOverrides: {},
};

export const WorkspaceStoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(workspaceReducer, initialState);

  const openTab = useCallback((key: string) => dispatch({ type: 'OPEN_TAB', key }), []);
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
