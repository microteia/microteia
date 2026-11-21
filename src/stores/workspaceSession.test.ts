// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  clearWorkspaceSession,
  loadWorkspaceSession,
  parseWorkspaceSnapshot,
  sanitizeWorkspaceSnapshot,
  saveWorkspaceSession,
  workspaceSessionScope,
} from './workspaceSession';
import type { WorkspaceSnapshot } from './workspaceReducer';

const dividido: WorkspaceSnapshot = {
  panels: {
    root: { id: 'root', tabKeys: ['dyn:a', 'view-dyn:a:1'], activeTabKey: 'view-dyn:a:1' },
    p2: { id: 'p2', tabKeys: ['news', 'reports'], activeTabKey: 'reports' },
  },
  layout: {
    type: 'split', id: 's1', direction: 'horizontal', ratio: 0.4,
    first: { type: 'panel', panelId: 'root' },
    second: { type: 'panel', panelId: 'p2' },
  },
  activePanelId: 'p2',
};

const all = () => true;

describe('a sessão do espaço de trabalho no aparelho (#15)', () => {
  beforeEach(() => window.localStorage.clear());

  it('o escopo é a pessoa E o escritório', () => {
    expect(workspaceSessionScope('u1', 't1')).toBe('u1:t1');
    expect(workspaceSessionScope(undefined, 't1')).toBeNull();
    expect(workspaceSessionScope('u1', undefined)).toBeNull();
  });

  it('grava e lê de volta abas, divisões e foco — sem título', () => {
    saveWorkspaceSession('u1:t1', { ...dividido, tabTitleOverrides: { news: 'Cliente X' } } as WorkspaceSnapshot);
    const raw = window.localStorage.getItem('microteia:workspace:u1:t1') ?? '';
    expect(raw).not.toContain('Cliente X');
    expect(loadWorkspaceSession('u1:t1')).toEqual(dividido);
    expect(loadWorkspaceSession('u1:t2')).toBeNull();
  });

  it('apagar some com a sessão daquele escopo só', () => {
    saveWorkspaceSession('u1:t1', dividido);
    saveWorkspaceSession('u1:t2', dividido);
    clearWorkspaceSession('u1:t1');
    expect(loadWorkspaceSession('u1:t1')).toBeNull();
    expect(loadWorkspaceSession('u1:t2')).toEqual(dividido);
  });

  it('armazenamento que recusa não quebra nada', () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('negado'); });
    expect(loadWorkspaceSession('u1:t1')).toBeNull();
    spy.mockRestore();
    const set = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('cota'); });
    expect(() => saveWorkspaceSession('u1:t1', dividido)).not.toThrow();
    set.mockRestore();
  });

  it('JSON corrompido ou de outra versão é descartado', () => {
    window.localStorage.setItem('microteia:workspace:u1:t1', '{nao-e-json');
    expect(loadWorkspaceSession('u1:t1')).toBeNull();
    expect(parseWorkspaceSnapshot({ v: 2, ...dividido })).toBeNull();
  });

  it('árvore e painéis incoerentes descartam a sessão inteira', () => {
    expect(parseWorkspaceSnapshot({ v: 1, ...dividido, panels: { root: dividido.panels.root } })).toBeNull();
    expect(parseWorkspaceSnapshot({ v: 1, ...dividido, layout: { type: 'panel', panelId: 'outro' } })).toBeNull();
  });

  it('a mesma aba em dois painéis fica só no primeiro', () => {
    const repetida = { v: 1, ...dividido, panels: { ...dividido.panels, p2: { id: 'p2', tabKeys: ['dyn:a', 'news'], activeTabKey: 'dyn:a' } } };
    expect(parseWorkspaceSnapshot(repetida)?.panels.p2).toEqual({ id: 'p2', tabKeys: ['news'], activeTabKey: 'news' });
  });

  it('sem filtro a recusar, a sessão volta inteira', () => {
    expect(sanitizeWorkspaceSnapshot(dividido, all)).toEqual(dividido);
  });

  it('a aba que não pode voltar sai, e a ativa passa para a primeira que sobrou', () => {
    const result = sanitizeWorkspaceSnapshot(dividido, (key) => key !== 'reports');
    expect(result?.panels.p2).toEqual({ id: 'p2', tabKeys: ['news'], activeTabKey: 'news' });
  });

  it('o painel que ficou vazio fecha, e a divisão some', () => {
    const result = sanitizeWorkspaceSnapshot(dividido, (key) => key.startsWith('dyn') || key.startsWith('view-dyn'));
    expect(result).toEqual({
      panels: { root: dividido.panels.root },
      layout: { type: 'panel', panelId: 'root' },
      activePanelId: 'root',
    });
  });

  it('sem nenhuma aba que possa voltar, não há sessão', () => {
    expect(sanitizeWorkspaceSnapshot(dividido, () => false)).toBeNull();
    expect(sanitizeWorkspaceSnapshot(null, all)).toBeNull();
  });

  it('o teto guarda primeiro a aba ativa de cada painel, depois as outras na ordem', () => {
    const result = sanitizeWorkspaceSnapshot(dividido, all, 3);
    expect(result?.panels.root.tabKeys).toEqual(['dyn:a', 'view-dyn:a:1']);
    expect(result?.panels.p2.tabKeys).toEqual(['reports']);
  });
});
