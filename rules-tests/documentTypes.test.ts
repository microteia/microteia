import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { addDoc, collection, deleteDoc, doc, getDocs, updateDoc } from 'firebase/firestore';
import { TENANT, asUser, seed, testEnv } from './helpers';

let env: RulesTestEnvironment;

beforeAll(async () => { env = await testEnv(); });
afterAll(async () => { await env.cleanup(); });

beforeEach(async () => {
  await env.clearFirestore();
  await seed(env, {
    users: { gestor: {}, instalador: {}, comum: {}, dono: {} },
    owners: { [TENANT]: 'dono' },
    members: {
      [TENANT]: {
        gestor: ['document-types.manage'],
        instalador: ['extensions.manage'],
        comum: [],
        dono: [],
      },
    },
    records: { [TENANT]: { 'documentTypes/recibo': { key: 'Recibo', label: 'Recibo' } } },
  });
});

const types = (uid: string) => collection(asUser(env, uid), `tenants/${TENANT}/documentTypes`);
const type = (uid: string) => doc(asUser(env, uid), `tenants/${TENANT}/documentTypes/recibo`);

/**
 * O kernel não traz tipo de documento nenhum: quem traz é a extensão, semeando a lista na instalação.
 * Por isso quem instala CRIA opções — e só cria: renomear e apagar continua sendo de quem gere a lista.
 */
describe('tipos de documento', () => {
  it('todo membro lê', async () => {
    await assertSucceeds(getDocs(types('comum')));
  });

  it('quem gere a lista cria, altera e apaga', async () => {
    await assertSucceeds(addDoc(types('gestor'), { key: 'Laudo', label: 'Laudo' }));
    await assertSucceeds(updateDoc(type('gestor'), { label: 'Recibo assinado' }));
    await assertSucceeds(deleteDoc(type('gestor')));
  });

  it('quem instala extensão só cria — é a semeadura', async () => {
    await assertSucceeds(addDoc(types('instalador'), { key: 'Laudo', label: 'Laudo' }));
    await assertFails(updateDoc(type('instalador'), { label: 'Outro' }));
    await assertFails(deleteDoc(type('instalador')));
  });

  it('membro sem nenhuma das duas não escreve', async () => {
    await assertFails(addDoc(types('comum'), { key: 'Laudo', label: 'Laudo' }));
  });
});
