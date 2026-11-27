import { describe, expect, it, vi } from 'vitest';

/**
 * A procedência que a instalação grava em cada artefato (`sourceRev`, `contentPluginId`) tem de VOLTAR
 * na leitura — é só ela que a regra de reescrita enxerga. Os mapeadores de ação, automação e script
 * descartavam o `sourceRev`, e a regra entre extensões nunca valeu para eles em produção, enquanto os
 * dublês em memória, que devolvem o objeto inteiro, faziam os testes passarem (#40).
 */

const stored = {
  key: 'k', title: 'T', name: 'N', eventName: 'workflow.called', workflowId: 'wf', steps: [], spec: { v: 1 },
  ownerPluginId: 'com.a', ownerPluginIds: ['com.a', 'com.b'], sourceId: 'src-1',
  sourceRev: 7, contentPluginId: 'com.b',
  createdAt: new Date(0), updatedAt: new Date(0),
};

vi.mock('../../infrastructure/firebase/config', () => ({ db: {}, functions: {} }));
vi.mock('firebase/functions', () => ({ httpsCallable: () => async () => ({ data: null }) }));
vi.mock('firebase/firestore', () => ({
  collection: (_db: unknown, ...segments: string[]) => ({ path: segments.join('/') }),
  doc: (parent: { path: string }, id?: string) => ({ path: `${parent.path}/${id ?? 'auto'}`, id: id ?? 'auto' }),
  getDocs: async () => ({ empty: false, docs: [{ id: 'a1', data: () => stored }] }),
  getDoc: async () => ({ exists: () => true, id: 'a1', data: () => stored }),
  onSnapshot: () => () => {},
  query: (...args: unknown[]) => args,
  orderBy: () => 'orderBy',
  limit: () => 'limit',
  where: () => 'where',
  serverTimestamp: () => 'SERVER_TIME',
  Timestamp: class {},
}));

import { FirebaseActionRepository } from './FirebaseActionRepository';
import { FirebaseWorkflowDefinitionRepository } from './FirebaseWorkflowDefinitionRepository';
import { FirebaseScriptRepository } from './FirebaseScriptRepository';
import { FirebaseReportDefinitionRepository } from './FirebaseReportDefinitionRepository';

const provenance = (artifact: { sourceRev?: number | null; contentPluginId?: string | null }) => ({
  sourceRev: artifact.sourceRev,
  contentPluginId: artifact.contentPluginId,
});

describe('procedência do artefato instalado na leitura do Firestore (#40)', () => {
  it('a ação devolve a revisão e quem gravou o conteúdo', async () => {
    const [action] = await new FirebaseActionRepository().getAll('t1');
    expect(provenance(action)).toEqual({ sourceRev: 7, contentPluginId: 'com.b' });
  });

  it('a automação devolve a revisão e quem gravou o conteúdo', async () => {
    const [workflow] = await new FirebaseWorkflowDefinitionRepository().getWorkflowDefinitions('t1');
    expect(provenance(workflow)).toEqual({ sourceRev: 7, contentPluginId: 'com.b' });
  });

  it('o script devolve a revisão e quem gravou o conteúdo', async () => {
    const [script] = await new FirebaseScriptRepository().getScripts('t1');
    expect(provenance(script)).toEqual({ sourceRev: 7, contentPluginId: 'com.b' });
  });

  it('o relatório devolve a revisão e quem gravou o conteúdo', async () => {
    const [report] = await new FirebaseReportDefinitionRepository().getAll('t1');
    expect(provenance(report)).toEqual({ sourceRev: 7, contentPluginId: 'com.b' });
  });
});
