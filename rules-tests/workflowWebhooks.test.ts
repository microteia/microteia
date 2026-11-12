import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { assertFails, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { deleteDoc, doc, getDoc, setDoc } from 'firebase/firestore';
import { TENANT, asUser, seed, testEnv } from './helpers';

/**
 * O hash do token do webhook não é lido nem gravado por ninguém pelo cliente — nem pelo dono, nem por
 * quem administra as automações. Quem emite é a callable; quem confere é a function de entrada.
 */
let env: RulesTestEnvironment;

beforeAll(async () => { env = await testEnv(); });
afterAll(async () => { await env.cleanup(); });

beforeEach(async () => {
  await env.clearFirestore();
  await seed(env, {
    users: { gestor: {} },
    owners: { [TENANT]: 'dono' },
    members: { [TENANT]: { gestor: ['automation.manage'] } },
    records: { [TENANT]: { 'workflow_webhooks/wf': { tokenHash: 'a'.repeat(64), hint: 'abcd' } } },
  });
});

describe('workflow_webhooks', () => {
  it('nem o dono nem quem administra as automações leem o hash', async () => {
    for (const uid of ['dono', 'gestor']) {
      await assertFails(getDoc(doc(asUser(env, uid), `tenants/${TENANT}/workflow_webhooks/wf`)));
    }
  });

  it('ninguém grava nem apaga pelo cliente', async () => {
    const db = asUser(env, 'dono');
    await assertFails(setDoc(doc(db, `tenants/${TENANT}/workflow_webhooks/novo`), { tokenHash: 'b'.repeat(64) }));
    await assertFails(deleteDoc(doc(db, `tenants/${TENANT}/workflow_webhooks/wf`)));
  });
});
