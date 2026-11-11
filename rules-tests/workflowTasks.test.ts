import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, doc, getDoc, getDocs, limit, orderBy, query, setDoc, updateDoc, where } from 'firebase/firestore';
import { OTHER_TENANT, TENANT, asUser, seed, testEnv } from './helpers';

/**
 * A regra das TAREFAS de aprovação: lê quem está designado e quem administra as automações; ninguém
 * grava pelo cliente — a decisão é da callable, que retoma a execução junto. A consulta da caixa
 * (`array-contains` no próprio uid) tem de ser provada pela regra sem ler documento nenhum.
 */
let env: RulesTestEnvironment;

beforeAll(async () => { env = await testEnv(); });
afterAll(async () => { await env.cleanup(); });

const task = (assigneeIds: string[]) => ({
  workflowDefinitionId: 'wf',
  executionId: 'ex',
  stepId: 'aprovar',
  title: 'Aprovar desconto',
  message: '',
  assigneeIds,
  outcomes: [{ key: 'approved', label: 'Aprovar' }],
  status: 'open',
  createdAt: new Date('2026-11-11T12:00:00Z'),
  dueAt: null,
  target: null,
});

beforeEach(async () => {
  await env.clearFirestore();
  await seed(env, {
    users: { ana: {}, bia: {}, gestor: {}, deFora: {} },
    owners: { [TENANT]: 'dono', [OTHER_TENANT]: 'outroDono' },
    members: {
      [TENANT]: { ana: [], bia: [], gestor: ['automation.manage'] },
      [OTHER_TENANT]: { deFora: ['automation.manage'] },
    },
    records: {
      [TENANT]: { 'workflow_tasks/t1': task(['ana']) },
    },
  });
});

const ref = (uid: string) => doc(asUser(env, uid), `tenants/${TENANT}/workflow_tasks/t1`);

describe('workflow_tasks', () => {
  it('o designado lê a tarefa; outro membro não', async () => {
    await assertSucceeds(getDoc(ref('ana')));
    await assertFails(getDoc(ref('bia')));
  });

  it('quem administra as automações acompanha a tarefa, e o dono também', async () => {
    await assertSucceeds(getDoc(ref('gestor')));
    await assertSucceeds(getDoc(ref('dono')));
  });

  it('a permissão de outro escritório não vale aqui', async () => {
    await assertFails(getDoc(ref('deFora')));
  });

  it('a consulta da caixa é provada pelo filtro do próprio uid', async () => {
    const tasks = collection(asUser(env, 'ana'), `tenants/${TENANT}/workflow_tasks`);
    await assertSucceeds(getDocs(query(
      tasks,
      where('assigneeIds', 'array-contains', 'ana'),
      where('status', '==', 'open'),
      orderBy('createdAt', 'desc'),
      limit(100),
    )));
  });

  it('ninguém grava pelo cliente — nem o designado decide por fora da callable', async () => {
    await assertFails(updateDoc(ref('ana'), { status: 'decided', outcome: 'approved' }));
    await assertFails(setDoc(doc(asUser(env, 'gestor'), `tenants/${TENANT}/workflow_tasks/t2`), task(['gestor'])));
  });
});
