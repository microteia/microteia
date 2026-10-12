import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { deleteDoc, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { OTHER_TENANT, TENANT, asUser, seed, testEnv } from './helpers';

/**
 * O job da adoção de chaves é do SERVIDOR. Todo membro lê, porque é dele que a listagem tira o aviso
 * das duplicatas; ninguém grava, porque quem escrevesse `adopted` daria por única uma chave com
 * registros repetidos embaixo dela.
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
      [TENANT]: { membro: ['pessoas.read'], gestor: ['screens.manage', 'pessoas.update'] },
      [OTHER_TENANT]: { deFora: ['screens.manage'] },
    },
    records: {
      [TENANT]: { 'record_key_adoptions/pessoas': { status: 'done', pending: { email: 'x' }, adopted: {}, issueCount: 1 } },
    },
  });
});

const job = (uid: string, tenantId: string = TENANT) =>
  doc(asUser(env, uid), `tenants/${tenantId}/record_key_adoptions/pessoas`);

describe('o job da adoção de chaves', () => {
  it('todo membro lê', async () => {
    await assertSucceeds(getDoc(job('membro')));
  });

  it('quem não é do escritório não lê', async () => {
    await assertFails(getDoc(job('deFora')));
  });

  it('ninguém grava do cliente — nem quem administra as telas', async () => {
    await assertFails(updateDoc(job('gestor'), { adopted: { email: 'x' }, pending: {}, issueCount: 0 }));
    await assertFails(setDoc(doc(asUser(env, 'gestor'), `tenants/${TENANT}/record_key_adoptions/outra`), { status: 'running' }));
    await assertFails(deleteDoc(job('gestor')));
  });

  it('o nome é reservado: nem o dono grava ali por uma tela com o mesmo nome', async () => {
    await env.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), `tenants/${TENANT}/screenDefinitions/record_key_adoptions`), {
        titleSingular: 'x', titleFieldKey: 'x', fields: [],
      });
    });
    await assertFails(setDoc(job('dono'), { status: 'done', adopted: { email: 'x' } }));
  });
});
