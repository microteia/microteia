/**
 * O reducer do espaço de trabalho, fora do Provider para ser testável: um `.tsx` só exporta componente.
 */
import type { WorkspacePanel, PanelNode, SplitDirection } from './useWorkspace';

let _counter = 0;
const genId = (prefix: string) => `${prefix}_${Date.now()}_${_counter++}`;

const ROOT_PANEL_ID = 'root';

export interface WorkspaceState {
  panels: Record<string, WorkspacePanel>;
  layout: PanelNode;
  activePanelId: string;
  tabTitleOverrides: Record<string, string>;
}

export type WorkspaceAction =
  | { type: 'OPEN_TAB'; key: string }
  | { type: 'OPEN_TABS'; keys: string[] }
  | { type: 'CLOSE_TAB'; key: string; panelId: string }
  | { type: 'CLOSE_OTHER_TABS'; keepKey: string; panelId: string }
  | { type: 'ACTIVATE_TAB'; key: string; panelId: string }
  | { type: 'SET_ACTIVE_PANEL'; panelId: string }
  | { type: 'CLOSE_PANEL'; panelId: string }
  | { type: 'SPLIT_PANEL'; panelId: string; direction: SplitDirection }
  | { type: 'UPDATE_SPLIT_RATIO'; splitId: string; ratio: number }
  | { type: 'SET_TAB_TITLE'; key: string; title: string };

export const findPanelForTab = (key: string, panels: Record<string, WorkspacePanel>): string | null => {
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

export const removePanelFromLayout = (node: PanelNode, targetId: string): PanelNode | null => {
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

export function workspaceReducer(state: WorkspaceState, action: WorkspaceAction): WorkspaceState {
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

    case 'OPEN_TABS': {
      const first = action.keys[0];
      if (first === undefined) return state;
      const targetPanelId = state.activePanelId;
      const panel = state.panels[targetPanelId];
      if (!panel) return state;
      const missing = action.keys.filter((key, index) =>
        action.keys.indexOf(key) === index && !findPanelForTab(key, state.panels));
      const opened = { ...state, panels: { ...state.panels, [targetPanelId]: { ...panel, tabKeys: [...panel.tabKeys, ...missing] } } };
      return workspaceReducer(opened, { type: 'OPEN_TAB', key: first });
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

export const initialWorkspaceState: WorkspaceState = {
  panels: { [ROOT_PANEL_ID]: { id: ROOT_PANEL_ID, tabKeys: [], activeTabKey: null } },
  layout: { type: 'panel', panelId: ROOT_PANEL_ID },
  activePanelId: ROOT_PANEL_ID,
  tabTitleOverrides: {},
};

/** O que sobrevive à sessão: abas, divisões e foco. Os títulos ficam de fora — são dado do escritório. */
export type WorkspaceSnapshot = Pick<WorkspaceState, 'panels' | 'layout' | 'activePanelId'>;

const openTabKeysOf = (state: WorkspaceState): string[] => Object.values(state.panels).flatMap((panel) => panel.tabKeys);

/**
 * A abertura do espaço de trabalho ao entrar no escritório (#15): o que ficou da última sessão, ou as
 * telas iniciais (#14) quando não há nada a reabrir. O que JÁ está aberto veio de um link (push, e-mail)
 * aberto antes da decisão — ele entra junto e mantém o foco, em vez de ser engolido pela restauração.
 */
export const hydrateWorkspace = (
  state: WorkspaceState,
  snapshot: WorkspaceSnapshot | null,
  homeKeys: string[],
): WorkspaceState => {
  const openKeys = openTabKeysOf(state);
  if (!snapshot) return openKeys.length === 0 ? workspaceReducer(state, { type: 'OPEN_TABS', keys: homeKeys }) : state;
  const focusKey = state.panels[state.activePanelId]?.activeTabKey ?? null;
  const restored: WorkspaceState = { ...snapshot, tabTitleOverrides: state.tabTitleOverrides };
  const merged = workspaceReducer(restored, { type: 'OPEN_TABS', keys: openKeys });
  return focusKey ? workspaceReducer(merged, { type: 'OPEN_TAB', key: focusKey }) : merged;
};

/**
 * O espaço de trabalho é de UMA pessoa num escritório (`scope` = `<uid>:<tenantId>`). Trocar de
 * escritório zera tudo na hora — antes, as abas de um ficavam abertas no outro, apontando para telas
 * e registros que lá não existem.
 *
 * `hydrated` diz que a abertura já foi decidida: até lá nada é gravado, para que o espaço vazio da
 * entrada não sobrescreva a sessão que ainda vai ser lida. `persist` é a escolha da pessoa.
 */
export interface WorkspaceSessionState {
  scope: string | null;
  hydrated: boolean;
  persist: boolean;
  workspace: WorkspaceState;
}

export type WorkspaceSessionAction = { scope: string | null } & (
  | WorkspaceAction
  | { type: 'HYDRATE'; snapshot: WorkspaceSnapshot | null; homeKeys: string[]; persist: boolean }
  | { type: 'SET_PERSIST'; persist: boolean }
);

export const emptyWorkspaceSession = (scope: string | null): WorkspaceSessionState => ({
  scope,
  hydrated: false,
  persist: false,
  workspace: initialWorkspaceState,
});

/**
 * Toda ação carrega o escopo de quem a disparou. Uma ação de outro escopo começa de um espaço vazio —
 * é assim que a troca de escritório zera o estado sem efeito nem `dispatch` durante o render, e sem
 * que um link aberto logo após a troca seja apagado por um reset que chegasse depois dele.
 */
export const workspaceSessionReducer = (
  current: WorkspaceSessionState,
  action: WorkspaceSessionAction,
): WorkspaceSessionState => {
  const session = current.scope === action.scope ? current : emptyWorkspaceSession(action.scope);
  switch (action.type) {
    case 'HYDRATE':
      if (session.hydrated) return session;
      return {
        ...session,
        hydrated: true,
        persist: action.persist,
        workspace: hydrateWorkspace(session.workspace, action.snapshot, action.homeKeys),
      };
    case 'SET_PERSIST':
      return session.persist === action.persist ? session : { ...session, persist: action.persist };
    default: {
      const workspace = workspaceReducer(session.workspace, action);
      return workspace === session.workspace && session === current ? current : { ...session, workspace };
    }
  }
};
