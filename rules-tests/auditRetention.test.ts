import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { deleteDoc, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { OTHER_TENANT, TENANT, asUser, seed, testEnv } from './helpers';

/**
 * A política de retenção da Auditoria e o andamento do arquivo são do SERVIDOR. Quem lê a Auditoria lê
 * a política; ninguém grava pelo cliente — nem quem a gerencia, que passa pela callable. Gravar direto
 * pularia a validação da faixa e a linha na Auditoria, e reescrever `state.headHash` esconderia o corte
 * do fim do arquivo.
 */
let env: RulesTestEnvironment;

beforeAll(async () => { env = await testEnv(); });
afterAll(async () => { await env.cleanup(); });

beforeEach(async () => {
  await env.clearFirestore();
  await seed(env, {
    users: { leitor: {}, gestor: {}, membro: {}, deFora: {} },
    owners: { [TENANT]: 'dono', [OTHER_TENANT]: 'outroDono' },
    members: {
      [TENANT]: { leitor: ['audit.read'], gestor: ['audit.read', 'audit.manage', 'settings.manage'], membro: [] },
      [OTHER_TENANT]: { deFora: ['audit.read', 'audit.manage'] },
    },
    root: {
      [`auditRetention/${TENANT}`]: {
        tenantId: TENANT, retentionDays: 365, archive: { enabled: true, retentionYears: 5 },
        state: { lastDay: '2026-10-25', headHash: 'a'.repeat(64) },
      },
    },
  });
});

const policy = (uid: string, tenantId: string = TENANT) => doc(asUser(env, uid), `auditRetention/${tenantId}`);

describe('auditRetention', () => {
  it('quem lê a Auditoria lê a política do escritório', async () => {
    await assertSucceeds(getDoc(policy('leitor')));
    await assertSucceeds(getDoc(policy('dono')));
  });

  it('membro sem audit.read e quem é de outro escritório não leem', async () => {
    await assertFails(getDoc(policy('membro')));
    await assertFails(getDoc(policy('deFora')));
  });

  it('ninguém grava pelo cliente — nem quem gerencia a retenção, nem o dono', async () => {
    await assertFails(updateDoc(policy('gestor'), { retentionDays: 30 }));
    await assertFails(updateDoc(policy('dono'), { 'archive.enabled': false }));
    await assertFails(updateDoc(policy('gestor'), { 'state.headHash': 'b'.repeat(64) }));
    await assertFails(setDoc(policy('dono', OTHER_TENANT), { retentionDays: 30 }));
    await assertFails(deleteDoc(policy('dono')));
  });
});
