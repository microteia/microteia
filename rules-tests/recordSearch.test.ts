import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { addDoc, collection, deleteField, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { RECORD_SEARCH_FIELD, RECORD_SEARCH_JOBS_COLLECTION, recordSearchBackfillJobId } from '../src/domain/schema/recordSearch';
import { TENANT, asUser, seed, testEnv } from './helpers';

/**
 * Os termos de busca são gravados pelo Admin SDK. Um termo escrito pelo cliente faria o registro
 * aparecer na busca por um nome que ele não tem, e o nome do campo vem da constante — a regra é texto,
 * e esta é a única ponta que pegaria as duas divergindo.
 */
let env: RulesTestEnvironment;

beforeAll(async () => { env = await testEnv(); });
afterAll(async () => { await env.cleanup(); });

beforeEach(async () => {
  await env.clearFirestore();
  await seed(env, {
    users: { escritor: {}, estranho: {} },
    owners: { [TENANT]: 'dono' },
    members: { [TENANT]: { escritor: ['pet1.read', 'pet1.create', 'pet1.update'] } },
    screens: { [TENANT]: { pet1: { titleSingular: 'Pet', titlePlural: 'Pets', fields: [] } } },
    records: { [TENANT]: { 'pet1/r1': { nome: 'Rex', createdBy: 'u-x', [RECORD_SEARCH_FIELD]: ['re', 'rex'] } } },
  });
});

const pets = () => collection(asUser(env, 'escritor'), `tenants/${TENANT}/pet1`);
const pet = () => doc(asUser(env, 'escritor'), `tenants/${TENANT}/pet1/r1`);

describe('os termos de busca são do servidor', () => {
  it('o cliente cria sem os termos', async () => {
    await assertSucceeds(addDoc(pets(), { nome: 'Bob', updatedVia: 'ui' }));
  });

  it('e não cria trazendo termos', async () => {
    await assertFails(addDoc(pets(), { nome: 'Bob', [RECORD_SEARCH_FIELD]: ['bo', 'bob'] }));
  });

  it('edita o registro que já tem termos sem tocar neles', async () => {
    await assertSucceeds(updateDoc(pet(), { nome: 'Rex II', updatedVia: 'ui' }));
  });

  it('não reescreve nem apaga os termos', async () => {
    await assertFails(updateDoc(pet(), { [RECORD_SEARCH_FIELD]: ['outro'], updatedVia: 'ui' }));
    await assertFails(updateDoc(pet(), { [RECORD_SEARCH_FIELD]: deleteField(), updatedVia: 'ui' }));
  });
});

describe('os jobs da busca', () => {
  const job = (uid: string) =>
    doc(asUser(env, uid), `tenants/${TENANT}/${RECORD_SEARCH_JOBS_COLLECTION}/${recordSearchBackfillJobId('pet1')}`);

  it('o membro lê o backfill da coleção — é como a listagem sabe se precisa pedir a conferência', async () => {
    await assertSucceeds(getDoc(job('escritor')));
  });

  it('quem não é do escritório não lê', async () => {
    await assertFails(getDoc(job('estranho')));
  });

  it('ninguém grava pelo cliente', async () => {
    await assertFails(setDoc(job('escritor'), { status: 'done', signature: 'forjada' }));
  });
});
