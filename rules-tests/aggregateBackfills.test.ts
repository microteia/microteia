import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { deleteDoc, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { OTHER_TENANT, TENANT, asUser, seed, testEnv } from './helpers';

/**
 * O job do recálculo de agregados é do SERVIDOR. Todo membro lê, porque é dele que a listagem tira o
 * aviso de uma passada bloqueada ou com falhas; ninguém grava, porque quem escreve `reconciled` dá por
 * recalculado o que não foi — e o campo ficaria vazio para sempre, sem ninguém saber por quê.
 */
let env: RulesTestEnvironment;

beforeAll(async () => { env = await testEnv(); });
afterAll(async () => { await env.cleanup(); });

beforeEach(async () => {
  await env.clearFirestore();
  await seed(env, {
    users: { membro: {}, gestor: {}, deFora: {} },
    owners: { [TENANT]: 'dono', [OTHER_TENANT]: 'outroDono' },
    members: {
      [TENANT]: { membro: ['vendas.read'], gestor: ['screens.manage', 'vendas.update'] },
      [OTHER_TENANT]: { deFora: ['screens.manage'] },
    },
    records: {
      [TENANT]: { 'aggregate_backfills/vendas': { status: 'running', pending: { total: 'x' }, reconciled: {} } },
    },
  });
});

const job = (uid: string, tenantId: string = TENANT) =>
  doc(asUser(env, uid), `tenants/${tenantId}/aggregate_backfills/vendas`);

describe('o job do recálculo de agregados', () => {
  it('todo membro lê', async () => {
    await assertSucceeds(getDoc(job('membro')));
  });

  it('quem não é do escritório não lê', async () => {
    await assertFails(getDoc(job('deFora')));
  });

  it('ninguém grava do cliente — nem quem administra as telas', async () => {
    await assertFails(updateDoc(job('gestor'), { reconciled: { total: 'x' }, status: 'done' }));
    await assertFails(setDoc(doc(asUser(env, 'gestor'), `tenants/${TENANT}/aggregate_backfills/outra`), { status: 'running' }));
    await assertFails(deleteDoc(job('gestor')));
  });
});
