import { describe, expect, it } from 'vitest';
import {
  EXTENSION_HISTORY_LIMIT,
  historyHasRevision,
  packageRevision,
  pruneHistory,
} from './extensionHistory';
import type { ExtensionHistory, ExtensionHistoryEntry } from '../../entities/ExtensionHistory';
import type { MarketplacePlugin } from '../../entities/MarketplacePlugin';

const pkg = (over: Partial<MarketplacePlugin['manifest']> = {}): MarketplacePlugin => ({
  manifest: { id: 'com.example.demo', version: '1.0.0', kernel: '*', name: 'Demo', ...over },
  summary: 'demo',
  workflows: [],
});

const entry = (revision: string, version = '1.0.0'): ExtensionHistoryEntry => ({
  revision,
  version,
  source: 'private',
  appliedAt: new Date('2026-08-30T12:00:00Z'),
  appliedBy: 'user-1',
  appliedByName: 'Alex',
});

describe('histórico de versões de extensão', () => {
  it('a revisão é do CONTEÚDO, não da versão declarada', async () => {
    const same = await Promise.all([packageRevision(pkg()), packageRevision(pkg())]);
    expect(same[0]).toBe(same[1]);

    const other = await packageRevision({ ...pkg(), summary: 'outro' });
    expect(other).not.toBe(same[0]);
  });

  /**
   * A ordem das chaves muda quando o pacote dá a volta pelo Firestore. Presa a ela, a revisão de uma
   * cópia lida do banco nunca casaria com a do pacote em memória, e toda aplicação criaria item novo.
   */
  it('a revisão ignora a ordem das chaves do pacote', async () => {
    const direct = await packageRevision({ manifest: pkg().manifest, summary: 'demo', workflows: [] });
    const shuffled = await packageRevision({ workflows: [], summary: 'demo', manifest: pkg().manifest });
    expect(direct).toBe(shuffled);
  });

  it('a mesma versão com código diferente produz revisões diferentes', async () => {
    const before = await packageRevision({ ...pkg(), views: [{ key: 'v', source: 'a' }] } as MarketplacePlugin);
    const after = await packageRevision({ ...pkg(), views: [{ key: 'v', source: 'b' }] } as MarketplacePlugin);
    expect(before).not.toBe(after);
  });

  it('reconhece a revisão que já está no histórico — é o que impede o item duplicado', () => {
    const history: ExtensionHistory = {
      pluginId: 'com.example.demo',
      tenantId: 't1',
      entries: [entry('aaa'), entry('bbb')],
    };
    expect(historyHasRevision(history, 'bbb')).toBe(true);
    expect(historyHasRevision(history, 'ccc')).toBe(false);
    expect(historyHasRevision(null, 'aaa')).toBe(false);
  });

  it('a poda corta no limite e devolve o que saiu, para o pacote sair junto', () => {
    const entries = Array.from({ length: EXTENSION_HISTORY_LIMIT + 3 }, (_, index) => entry(`r${index}`));
    const pruned = pruneHistory(entries);

    expect(pruned.entries).toHaveLength(EXTENSION_HISTORY_LIMIT);
    expect(pruned.dropped.map((item) => item.revision)).toEqual(['r10', 'r11', 'r12']);
  });

  it('abaixo do limite nada é descartado', () => {
    const pruned = pruneHistory([entry('a'), entry('b')]);
    expect(pruned.entries).toHaveLength(2);
    expect(pruned.dropped).toHaveLength(0);
  });
});
