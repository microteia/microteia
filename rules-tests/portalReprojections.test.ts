import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { deleteDoc, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { OTHER_TENANT, TENANT, asUser, seed, testEnv } from './helpers';

/**
 * O job da reprojeção do portal é do SERVIDOR. Lê quem decide o que sai do escritório; ninguém grava,
 * porque quem escreve `status: 'done'` dá por refeita a passada que ainda tinha projeção para apagar —
 * e o registro escondido continuaria no portal.
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
      [TENANT]: { membro: ['vendas.read', 'screens.manage'], gestor: ['portal.manage'] },
      [OTHER_TENANT]: { deFora: ['portal.manage'] },
    },
    records: {
      [TENANT]: { 'portal_reprojections/vendas': { status: 'running', generation: 1, cursor: null } },
    },
  });
});

const job = (uid: string, tenantId: string = TENANT) =>
  doc(asUser(env, uid), `tenants/${tenantId}/portal_reprojections/vendas`);

describe('o job da reprojeção do portal', () => {
  it('quem administra o portal lê', async () => {
    await assertSucceeds(getDoc(job('gestor')));
  });

  it('o membro sem portal.manage não lê, nem quem é de fora', async () => {
    await assertFails(getDoc(job('membro')));
    await assertFails(getDoc(job('deFora')));
  });

  it('ninguém grava do cliente — nem quem administra o portal', async () => {
    await assertFails(updateDoc(job('gestor'), { status: 'done' }));
    await assertFails(setDoc(doc(asUser(env, 'gestor'), `tenants/${TENANT}/portal_reprojections/outra`), { status: 'running' }));
    await assertFails(deleteDoc(job('gestor')));
  });
});
