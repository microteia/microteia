import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { OTHER_TENANT, TENANT, asUser, seed, testEnv } from './helpers';

/** As versões de uma automação: todo membro lê; ninguém grava pelo cliente — nem quem administra. */
let env: RulesTestEnvironment;

beforeAll(async () => { env = await testEnv(); });
afterAll(async () => { await env.cleanup(); });

const path = `tenants/${TENANT}/workflow_definitions/wf/versions/1`;

beforeEach(async () => {
  await env.clearFirestore();
  await seed(env, {
    users: { ana: {}, gestor: {}, deFora: {} },
    owners: { [TENANT]: 'dono', [OTHER_TENANT]: 'outroDono' },
    members: { [TENANT]: { ana: [], gestor: ['automation.manage'] }, [OTHER_TENANT]: { deFora: [] } },
    records: { [TENANT]: { 'workflow_definitions/wf/versions/1': { version: 1, content: { name: 'x' } } } },
  });
});

describe('workflow_definitions/{id}/versions', () => {
  it('todo membro lê; quem é de outro escritório, não', async () => {
    await assertSucceeds(getDoc(doc(asUser(env, 'ana'), path)));
    await assertFails(getDoc(doc(asUser(env, 'deFora'), path)));
  });

  it('ninguém grava uma versão pelo cliente — ela nasce do gatilho', async () => {
    for (const uid of ['gestor', 'dono']) {
      await assertFails(setDoc(doc(asUser(env, uid), `tenants/${TENANT}/workflow_definitions/wf/versions/9`), { version: 9 }));
    }
  });
});
