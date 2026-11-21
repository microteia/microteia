/**
 * A sessão do espaço de trabalho guardada NO APARELHO, por pessoa e por escritório (#15).
 *
 * No aparelho, e não no Firestore, por decisão: reabrir as abas é conveniência de quem senta naquela
 * máquina, e gravar no servidor a cada troca de aba custaria escrita, regra e teste de regra para isso.
 * O que se guarda são CHAVES de aba — nunca o título, que carrega dado do escritório.
 */
import type { PanelNode, WorkspacePanel } from './useWorkspace';
import { removePanelFromLayout, type WorkspaceSnapshot } from './workspaceReducer';

const STORAGE_PREFIX = 'microteia:workspace:';
const SNAPSHOT_VERSION = 1;

/**
 * Toda aba restaurada monta junto (o painel desenha todas, escondendo as inativas), e cada uma lê o
 * próprio dado. Sem teto, quem saiu com quarenta registros abertos entraria com quarenta leituras.
 */
export const MAX_RESTORED_TABS = 15;

export const workspaceSessionScope = (userId: string | undefined, tenantId: string | undefined): string | null =>
  userId && tenantId ? `${userId}:${tenantId}` : null;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const leafIdsOf = (node: PanelNode): string[] =>
  node.type === 'panel' ? [node.panelId] : [...leafIdsOf(node.first), ...leafIdsOf(node.second)];

const parseLayout = (value: unknown): PanelNode | null => {
  if (!isRecord(value)) return null;
  if (value.type === 'panel') return typeof value.panelId === 'string' ? { type: 'panel', panelId: value.panelId } : null;
  if (value.type !== 'split') return null;
  const { id, direction, ratio } = value;
  if (typeof id !== 'string' || (direction !== 'horizontal' && direction !== 'vertical')) return null;
  if (typeof ratio !== 'number' || !(ratio > 0 && ratio < 1)) return null;
  const first = parseLayout(value.first);
  const second = parseLayout(value.second);
  return first && second ? { type: 'split', id, direction, ratio, first, second } : null;
};

/** Uma aba vive num painel só (`findPanelForTab`); a repetida em outro painel é descartada. */
const parsePanel = (id: string, value: unknown, seen: Set<string>): WorkspacePanel | null => {
  if (!isRecord(value) || !Array.isArray(value.tabKeys)) return null;
  const tabKeys = value.tabKeys.filter((key): key is string => typeof key === 'string' && key !== '' && !seen.has(key));
  for (const key of tabKeys) seen.add(key);
  const activeTabKey = typeof value.activeTabKey === 'string' && tabKeys.includes(value.activeTabKey)
    ? value.activeTabKey
    : tabKeys[0] ?? null;
  return { id, tabKeys, activeTabKey };
};

/**
 * O que veio do armazenamento é tratado como entrada externa: outra versão do app, outra aba do
 * navegador ou a mão de alguém pode ter escrito ali. Qualquer incoerência entre a árvore e os painéis
 * descarta a sessão inteira — entrar pelas telas iniciais é melhor que entrar num layout quebrado.
 */
export const parseWorkspaceSnapshot = (raw: unknown): WorkspaceSnapshot | null => {
  if (!isRecord(raw) || raw.v !== SNAPSHOT_VERSION || !isRecord(raw.panels)) return null;
  const layout = parseLayout(raw.layout);
  if (!layout) return null;
  const leafIds = leafIdsOf(layout);
  if (new Set(leafIds).size !== leafIds.length || leafIds.length !== Object.keys(raw.panels).length) return null;
  const panels: Record<string, WorkspacePanel> = {};
  const seen = new Set<string>();
  for (const id of leafIds) {
    const panel = parsePanel(id, raw.panels[id], seen);
    if (!panel) return null;
    panels[id] = panel;
  }
  const activePanelId = typeof raw.activePanelId === 'string' && panels[raw.activePanelId] ? raw.activePanelId : leafIds[0];
  return { panels, layout, activePanelId };
};

/**
 * O teto prefere o que a pessoa via: primeiro a aba ativa de cada painel, depois as outras na ordem
 * em que estavam.
 */
const keptKeys = (panels: WorkspacePanel[], max: number): Set<string> => {
  const kept = new Set<string>();
  for (const panel of panels) {
    if (kept.size >= max) break;
    if (panel.activeTabKey) kept.add(panel.activeTabKey);
  }
  for (const panel of panels) {
    for (const key of panel.tabKeys) {
      if (kept.size >= max) return kept;
      kept.add(key);
    }
  }
  return kept;
};

/**
 * O que pode voltar NESTE escritório, para ESTA pessoa, agora: a aba cuja página sumiu (extensão
 * desinstalada) ou deixou de ser permitida sai, e o painel que ficou vazio fecha. Sem nenhuma aba, não
 * há sessão — e a entrada abre as telas iniciais.
 */
export const sanitizeWorkspaceSnapshot = (
  snapshot: WorkspaceSnapshot | null,
  isRestorable: (tabKey: string) => boolean,
  max: number = MAX_RESTORED_TABS,
): WorkspaceSnapshot | null => {
  if (!snapshot) return null;
  const filtered = Object.values(snapshot.panels).map((panel) => {
    const tabKeys = panel.tabKeys.filter(isRestorable);
    return { ...panel, tabKeys, activeTabKey: tabKeys.includes(panel.activeTabKey ?? '') ? panel.activeTabKey : tabKeys[0] ?? null };
  });
  const kept = keptKeys(filtered, max);

  let layout: PanelNode | null = snapshot.layout;
  const panels: Record<string, WorkspacePanel> = {};
  for (const panel of filtered) {
    const tabKeys = panel.tabKeys.filter((key) => kept.has(key));
    if (tabKeys.length === 0) {
      layout = layout && removePanelFromLayout(layout, panel.id);
      continue;
    }
    const activeTabKey = tabKeys.includes(panel.activeTabKey ?? '') ? panel.activeTabKey : tabKeys[0];
    panels[panel.id] = { id: panel.id, tabKeys, activeTabKey };
  }
  if (!layout || Object.keys(panels).length === 0) return null;
  const activePanelId = panels[snapshot.activePanelId] ? snapshot.activePanelId : leafIdsOf(layout)[0];
  return { panels, layout, activePanelId };
};

/** O armazenamento pode faltar ou recusar (janela anônima, cota): a sessão some, o app não. */
export const loadWorkspaceSession = (scope: string): WorkspaceSnapshot | null => {
  try {
    const raw = window.localStorage.getItem(`${STORAGE_PREFIX}${scope}`);
    return raw ? parseWorkspaceSnapshot(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
};

export const saveWorkspaceSession = (scope: string, snapshot: WorkspaceSnapshot): void => {
  try {
    const { panels, layout, activePanelId } = snapshot;
    window.localStorage.setItem(`${STORAGE_PREFIX}${scope}`, JSON.stringify({ v: SNAPSHOT_VERSION, panels, layout, activePanelId }));
  } catch {
    // Sem armazenamento, a sessão simplesmente não volta na próxima entrada.
  }
};

export const clearWorkspaceSession = (scope: string): void => {
  try {
    window.localStorage.removeItem(`${STORAGE_PREFIX}${scope}`);
  } catch {
    // Idem: não há o que apagar onde não se pôde gravar.
  }
};
