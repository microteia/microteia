import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, doc, getDoc, getDocs, limit, orderBy, query, setDoc, where } from 'firebase/firestore';
import { OTHER_TENANT, TENANT, asUser, seed, testEnv } from './helpers';

/**
 * O histórico de execução em dois documentos: o RESUMO é de todo membro, o DETALHE — o que cada passo
 * recebeu e devolveu — é de quem gerencia automações. O histórico antigo, num documento só, fica com
 * quem gerencia. E a consulta do Processador (`schema == 2`) tem de ser provada pela regra.
 */
let env: RulesTestEnvironment;

beforeAll(async () => { env = await testEnv(); });
afterAll(async () => { await env.cleanup(); });

const startedAt = new Date('2026-11-17T12:00:00Z');

beforeEach(async () => {
  await env.clearFirestore();
  await seed(env, {
    users: { membro: {}, executor: {}, gestor: {}, deFora: {} },
    owners: { [TENANT]: 'dono', [OTHER_TENANT]: 'outroDono' },
    members: {
      [TENANT]: { membro: [], executor: ['automation.run'], gestor: ['automation.manage'] },
      [OTHER_TENANT]: { deFora: ['automation.manage'] },
    },
    records: {
      [TENANT]: {
        'workflow_executions/novo': { schema: 2, workflowDefinitionId: 'wf', eventId: 'e1', status: 'SUCCESS', startedAt, actorId: 'executor' },
        'workflow_executions/novo/detail/run': { logs: [{ message: 'salário 12.000' }], outputs: { salario: 12000 } },
        'workflow_executions/antigo': {
          workflowDefinitionId: 'wf', eventId: 'e0', status: 'SUCCESS', startedAt,
          logs: [{ message: 'salário 9.000' }], outputs: { salario: 9000 },
        },
      },
    },
  });
});

const execution = (uid: string, path: string, tenantId: string = TENANT) =>
  doc(asUser(env, uid), `tenants/${tenantId}/workflow_executions/${path}`);

describe('o resumo da execução', () => {
  it('todo membro lê', async () => {
    await assertSucceeds(getDoc(execution('membro', 'novo')));
    await assertSucceeds(getDoc(execution('executor', 'novo')));
  });

  it('quem não é do escritório não lê', async () => {
    await assertFails(getDoc(execution('deFora', 'novo')));
  });

  it('a consulta do Processador, com `schema == 2`, é provada pela regra', async () => {
    const executions = collection(asUser(env, 'executor'), `tenants/${TENANT}/workflow_executions`);
    await assertSucceeds(getDocs(query(executions, where('workflowDefinitionId', '==', 'wf'), where('schema', '==', 2), orderBy('startedAt', 'desc'), limit(100))));
  });

  it('a mesma consulta sem `schema` é recusada a quem não gerencia — alcançaria o histórico antigo', async () => {
    const executions = collection(asUser(env, 'executor'), `tenants/${TENANT}/workflow_executions`);
    await assertFails(getDocs(query(executions, where('workflowDefinitionId', '==', 'wf'), orderBy('startedAt', 'desc'), limit(100))));
  });

  it('quem gerencia consulta sem `schema`, e alcança também o antigo', async () => {
    const executions = collection(asUser(env, 'gestor'), `tenants/${TENANT}/workflow_executions`);
    await assertSucceeds(getDocs(query(executions, where('workflowDefinitionId', '==', 'wf'), orderBy('startedAt', 'desc'), limit(100))));
  });
});

describe('o detalhe e o histórico antigo', () => {
  it('só quem gerencia automações, e o dono, leem o detalhe', async () => {
    await assertSucceeds(getDoc(execution('gestor', 'novo/detail/run')));
    await assertSucceeds(getDoc(execution('dono', 'novo/detail/run')));
    await assertFails(getDoc(execution('membro', 'novo/detail/run')));
    await assertFails(getDoc(execution('executor', 'novo/detail/run')));
    await assertFails(getDoc(execution('deFora', 'novo/detail/run')));
  });

  it('o histórico antigo, com os dados no mesmo documento, só quem gerencia lê', async () => {
    await assertSucceeds(getDoc(execution('gestor', 'antigo')));
    await assertFails(getDoc(execution('membro', 'antigo')));
    await assertFails(getDoc(execution('executor', 'antigo')));
  });

  it('ninguém grava pelo cliente, nem o dono', async () => {
    await assertFails(setDoc(execution('dono', 'novo'), { status: 'FAILED' }, { merge: true }));
    await assertFails(setDoc(execution('gestor', 'novo/detail/run'), { logs: [] }));
  });
});
