import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import {
  addDoc, collection, deleteDoc, doc, getDoc, getDocs, query, setDoc, updateDoc, where,
} from 'firebase/firestore';
import { TENANT, asAnonymous, asUser, seed, testEnv } from './helpers';

/**
 * O sino e as inscrições de push.
 *
 * O sino é do servidor: só o Admin SDK cria. Cada pessoa lê as SUAS e só pode marcá-las como lidas —
 * título e destinatário são do fluxo que enviou, e reescrevê-los seria forjar um aviso.
 *
 * A inscrição de push é da pessoa, e o servidor faz um POST ao `endpoint` dela: por isso só `https`.
 */
let env: RulesTestEnvironment;

beforeAll(async () => { env = await testEnv(); });
afterAll(async () => { await env.cleanup(); });

const INBOX = `tenants/${TENANT}/notification_inbox`;
const DELA = `${INBOX}/n1`;

beforeEach(async () => {
  await env.clearFirestore();
  await seed(env, {
    users: { dela: {}, outra: {} },
    owners: { [TENANT]: 'dono' },
    members: { [TENANT]: { dela: [], outra: [] } },
  });
  await env.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore() as never, DELA), {
      recipientId: 'dela',
      title: '@ext/title',
      message: 'texto',
      params: {},
      link: '',
      read: false,
      readAt: null,
    });
  });
});

describe('notification_inbox', () => {
  it('a destinatária lê a sua, e outra pessoa não', async () => {
    await assertSucceeds(getDoc(doc(asUser(env, 'dela'), DELA)));
    await assertFails(getDoc(doc(asUser(env, 'outra'), DELA)));
    await assertFails(getDoc(doc(asAnonymous(env), DELA)));
  });

  it('a consulta só passa filtrando pela própria pessoa', async () => {
    await assertSucceeds(getDocs(query(collection(asUser(env, 'dela'), INBOX), where('recipientId', '==', 'dela'))));
    await assertFails(getDocs(collection(asUser(env, 'dela'), INBOX)));
  });

  it('marcar como lida é a única escrita', async () => {
    await assertSucceeds(updateDoc(doc(asUser(env, 'dela'), DELA), { read: true }));
    await assertFails(updateDoc(doc(asUser(env, 'dela'), DELA), { title: 'forjado' }));
    await assertFails(updateDoc(doc(asUser(env, 'dela'), DELA), { recipientId: 'outra' }));
    await assertFails(updateDoc(doc(asUser(env, 'outra'), DELA), { read: true }));
  });

  it('marcar como NÃO lida também passa — e o alvo e o tipo do aviso não se reescrevem', async () => {
    await assertSucceeds(updateDoc(doc(asUser(env, 'dela'), DELA), { read: true }));
    await assertSucceeds(updateDoc(doc(asUser(env, 'dela'), DELA), { read: false, readAt: null }));
    await assertFails(updateDoc(doc(asUser(env, 'dela'), DELA), { target: { collection: 'x', recordId: 'y' } }));
    await assertFails(updateDoc(doc(asUser(env, 'dela'), DELA), { category: 'outro/tipo' }));
  });

  it('a página filtra por tipo e por não lidas, sempre da própria pessoa', async () => {
    await assertSucceeds(getDocs(query(
      collection(asUser(env, 'dela'), INBOX), where('recipientId', '==', 'dela'), where('category', '==', ''), where('read', '==', false),
    )));
  });

  it('ninguém cria nem apaga pelo cliente', async () => {
    await assertFails(addDoc(collection(asUser(env, 'dono'), INBOX), { recipientId: 'dela', title: 'x' }));
    await assertFails(deleteDoc(doc(asUser(env, 'dela'), DELA)));
  });
});

describe('push_subscriptions', () => {
  const inscricao = (endpoint: string) => ({
    endpoint,
    keys: { p256dh: 'p', auth: 'a' },
    userAgent: 'test',
    createdAt: new Date(),
  });

  it('a pessoa grava e lê a própria inscrição https', async () => {
    const ref = doc(asUser(env, 'dela'), 'users/dela/push_subscriptions/s1');
    await assertSucceeds(setDoc(ref, inscricao('https://fcm.googleapis.com/fcm/send/abc')));
    await assertSucceeds(getDoc(ref));
    await assertSucceeds(deleteDoc(ref));
  });

  it('recusa endpoint sem https e campo a mais', async () => {
    const ref = doc(asUser(env, 'dela'), 'users/dela/push_subscriptions/s1');
    await assertFails(setDoc(ref, inscricao('http://169.254.169.254/latest')));
    await assertFails(setDoc(ref, { ...inscricao('https://fcm.googleapis.com/x'), extra: true }));
  });

  it('ninguém grava nem lê a inscrição de outra pessoa', async () => {
    await assertFails(setDoc(doc(asUser(env, 'outra'), 'users/dela/push_subscriptions/s1'), inscricao('https://fcm.googleapis.com/x')));
    await assertFails(getDoc(doc(asUser(env, 'outra'), 'users/dela/push_subscriptions/s1')));
  });
});

describe('notification_dispatches', () => {
  it('as marcas de despacho são só do servidor — nem o dono lê ou grava', async () => {
    const marca = doc(asUser(env, 'dono'), `tenants/${TENANT}/notification_dispatches/abc`);
    await assertFails(getDoc(marca));
    await assertFails(setDoc(marca, { createdAt: new Date() }));
  });
});

