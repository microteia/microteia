import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDoc, getDocs, orderBy, query, setDoc, updateDoc, where } from 'firebase/firestore';
import { OTHER_TENANT, TENANT, asUser, seed, testEnv } from './helpers';

/**
 * As conversas do assistente de IA: só o dono lê — nem o dono do escritório —, e ninguém grava pelo
 * cliente. Quem conduz a conversa é a function, que mantém a trava e os contadores; uma escrita do
 * cliente desmontaria os dois.
 */
let env: RulesTestEnvironment;

beforeAll(async () => { env = await testEnv(); });
afterAll(async () => { await env.cleanup(); });

beforeEach(async () => {
  await env.clearFirestore();
  await seed(env, {
    users: { ana: {}, bia: {}, deFora: {} },
    owners: { [TENANT]: 'dono', [OTHER_TENANT]: 'outroDono' },
    members: {
      [TENANT]: { ana: ['assistant.use'], bia: ['assistant.use'] },
      [OTHER_TENANT]: { deFora: ['assistant.use'] },
    },
    records: {
      [TENANT]: {
        'assistantConversations/daAna': { ownerId: 'ana', title: 'Oi', status: 'idle', updatedAt: 1 },
      },
    },
  });
  // O `seed` só entende `coleção/id`; a mensagem mora numa subcoleção.
  await env.withSecurityRulesDisabled(async (context) => {
    await setDoc(
      doc(context.firestore(), `tenants/${TENANT}/assistantConversations/daAna/messages/000000`),
      { seq: 0, role: 'user', kind: 'message', parts: [] },
    );
  });
});

const conversation = (uid: string, id = 'daAna', tenantId: string = TENANT) =>
  doc(asUser(env, uid), `tenants/${tenantId}/assistantConversations/${id}`);
const message = (uid: string, id = '000000') =>
  doc(asUser(env, uid), `tenants/${TENANT}/assistantConversations/daAna/messages/${id}`);

describe('leitura', () => {
  it('o dono lê a conversa, as mensagens e a lista dele pela consulta por ownerId', async () => {
    await assertSucceeds(getDoc(conversation('ana')));
    await assertSucceeds(getDoc(message('ana')));
    await assertSucceeds(getDocs(query(
      collection(asUser(env, 'ana'), `tenants/${TENANT}/assistantConversations`),
      where('ownerId', '==', 'ana'),
      orderBy('updatedAt', 'desc'),
    )));
  });

  it('outro membro não lê — nem o dono do escritório', async () => {
    await assertFails(getDoc(conversation('bia')));
    await assertFails(getDoc(message('bia')));
    await assertFails(getDoc(conversation('dono')));
    await assertFails(getDoc(message('dono')));
  });

  it('a lista sem filtro por dono é recusada', async () => {
    await assertFails(getDocs(collection(asUser(env, 'ana'), `tenants/${TENANT}/assistantConversations`)));
  });

  it('quem é de outro escritório não lê', async () => {
    await assertFails(getDoc(conversation('deFora')));
  });
});

describe('escrita', () => {
  it('nem o dono da conversa grava pelo cliente', async () => {
    await assertFails(setDoc(conversation('ana', 'nova'), { ownerId: 'ana', title: 'Nova' }));
    await assertFails(updateDoc(conversation('ana'), { title: 'Outro' }));
    await assertFails(deleteDoc(conversation('ana')));
    await assertFails(setDoc(message('ana', '000001'), { seq: 1, role: 'user', kind: 'message', parts: [] }));
  });

  it('o nome não pode ser reivindicado por uma tela do Form Design', async () => {
    await assertFails(setDoc(doc(asUser(env, 'dono'), `tenants/${TENANT}/assistantConversations/x`), { ownerId: 'dono' }));
  });
});
