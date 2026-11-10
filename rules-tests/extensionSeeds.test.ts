import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { addDoc, collection, deleteDoc, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { OTHER_TENANT, TENANT, asUser, seed, testEnv } from './helpers';

/**
 * O histórico da semeadura (`screens[].seed`) é do SERVIDOR. Lê quem instala; ninguém grava do cliente:
 * gravar `delivered` impediria a semente de chegar, e apagá-lo reentregaria o que o escritório apagou.
 * E a marca `createdVia: 'extension-seed'` — a que tira o registro do `.saved` e da auditoria — não pode
 * nascer de um cliente.
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
      [TENANT]: { membro: ['racas.read', 'racas.create'], gestor: ['extensions.manage', 'racas.create'] },
      [OTHER_TENANT]: { deFora: ['extensions.manage'] },
    },
    screens: { [TENANT]: { racas: {} } },
    records: {
      [TENANT]: { 'extension_seeds/com.acme.pets': { screens: { breeds: { planned: null, delivered: ['labrador'] } } } },
    },
  });
});

const ledger = (uid: string, tenantId: string = TENANT) =>
  doc(asUser(env, uid), `tenants/${tenantId}/extension_seeds/com.acme.pets`);

describe('o histórico da semeadura de extensão', () => {
  it('lê quem instala extensões', async () => {
    await assertSucceeds(getDoc(ledger('gestor')));
  });

  it('o membro sem a permissão não lê, nem quem é de outro escritório', async () => {
    await assertFails(getDoc(ledger('membro')));
    await assertFails(getDoc(ledger('deFora')));
  });

  it('ninguém grava do cliente — nem quem instala', async () => {
    await assertFails(updateDoc(ledger('gestor'), { 'screens.breeds.delivered': [] }));
    await assertFails(setDoc(doc(asUser(env, 'gestor'), `tenants/${TENANT}/extension_seeds/outra`), { screens: {} }));
    await assertFails(deleteDoc(ledger('gestor')));
  });

  it('o nome é reservado: nenhuma tela grava registros nele', async () => {
    await assertFails(addDoc(collection(asUser(env, 'gestor'), `tenants/${TENANT}/extension_seeds`), { name: 'x' }));
  });
});

describe('a marca da semente', () => {
  it('o cliente não cria um registro marcado como semente', async () => {
    await assertFails(addDoc(collection(asUser(env, 'gestor'), `tenants/${TENANT}/racas`), {
      name: 'Labrador',
      createdVia: 'extension-seed',
    }));
    await assertSucceeds(addDoc(collection(asUser(env, 'gestor'), `tenants/${TENANT}/racas`), {
      name: 'Labrador',
      createdVia: 'ui',
    }));
  });
});
