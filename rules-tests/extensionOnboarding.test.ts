import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { deleteDoc, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { OTHER_TENANT, TENANT, asUser, seed, testEnv } from './helpers';

/**
 * `extension_onboarding/defaults` — as extensões PADRÃO que o escritório novo ainda tem a instalar. O
 * servidor a cria na criação do escritório; o navegador de quem instala tira dela o que concluiu. Ela
 * só NOMEIA extensões do catálogo, e instalar continua exigindo a permissão: forjá-la não dá nada.
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
      [TENANT]: { membro: ['clientes.read'], gestor: ['extensions.manage'] },
      [OTHER_TENANT]: { deFora: ['extensions.manage'] },
    },
    records: {
      [TENANT]: { 'extension_onboarding/defaults': { pending: ['com.acme.a', 'com.acme.b'], failed: [] } },
    },
  });
});

const onboarding = (uid: string, tenantId: string = TENANT) =>
  doc(asUser(env, uid), `tenants/${tenantId}/extension_onboarding/defaults`);

describe('a lista de extensões padrão do escritório novo', () => {
  it('todo membro lê — é ela que diz à primeira carga que há o que esperar', async () => {
    await assertSucceeds(getDoc(onboarding('membro')));
    await assertSucceeds(getDoc(onboarding('gestor')));
  });

  it('quem é de outro escritório não lê', async () => {
    await assertFails(getDoc(onboarding('deFora')));
  });

  it('quem instala extensões tira da lista o que concluiu, ou o adia', async () => {
    await assertSucceeds(updateDoc(onboarding('gestor'), { pending: ['com.acme.b'], failed: ['com.acme.a'] }));
  });

  it('o membro sem a permissão não mexe nela', async () => {
    await assertFails(updateDoc(onboarding('membro'), { pending: [] }));
  });

  it('nenhum cliente a cria — é o servidor, na criação do escritório', async () => {
    await assertFails(setDoc(doc(asUser(env, 'deFora'), `tenants/${OTHER_TENANT}/extension_onboarding/defaults`), {
      pending: ['com.acme.a'], failed: [],
    }));
  });

  it('não aceita campo fora do formato', async () => {
    await assertFails(updateDoc(onboarding('gestor'), { pending: 'com.acme.a' }));
    await assertFails(updateDoc(onboarding('gestor'), { extra: true }));
  });

  it('quem instala a apaga quando acabou', async () => {
    await assertSucceeds(deleteDoc(onboarding('gestor')));
  });
});
