import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { arrayRemove, arrayUnion, doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { asAnonymous, asUser, seed, testEnv } from './helpers';

/**
 * A trava de contas novas da instalação (`system/registration`) e a recusa que o gatilho de criação
 * grava para quem tentou entrar (`registrationRefusals/{uid}`). A trava é só do SYSTEM; a recusa, só de
 * quem foi recusado — e ninguém a escreve pelo navegador.
 */
let env: RulesTestEnvironment;

beforeAll(async () => { env = await testEnv(); });
afterAll(async () => { await env.cleanup(); });

beforeEach(async () => {
  await env.clearFirestore();
  await seed(env, {
    users: { sys: { role: 'SYSTEM' }, comum: {} },
    root: {
      'system/registration': { acceptNewAccounts: false, updatedBy: 'sys' },
      'system/bootstrap': { claimedBy: 'sys' },
      'registrationRefusals/recusado': { email: 'x@y.com' },
    },
  });
});

const policy = (uid: string) => doc(asUser(env, uid), 'system/registration');
const change = (uid: string, acceptNewAccounts: unknown) =>
  setDoc(policy(uid), { acceptNewAccounts, updatedBy: uid, updatedAt: serverTimestamp() });

describe('system/registration', () => {
  it('o SYSTEM lê e muda a trava', async () => {
    await assertSucceeds(getDoc(policy('sys')));
    await assertSucceeds(change('sys', true));
  });

  it('quem não é SYSTEM não lê nem muda', async () => {
    await assertFails(getDoc(policy('comum')));
    await assertFails(change('comum', true));
    await assertFails(getDoc(doc(asAnonymous(env), 'system/registration')));
  });

  it('o SYSTEM não grava valor fora do formato, nem em nome de outro', async () => {
    await assertFails(change('sys', 'sim'));
    await assertFails(setDoc(policy('sys'), { acceptNewAccounts: true, updatedBy: 'outro', updatedAt: serverTimestamp() }));
    await assertFails(setDoc(policy('sys'), {
      acceptNewAccounts: true, updatedBy: 'sys', updatedAt: serverTimestamp(), extra: 1,
    }));
  });

  it('o SYSTEM liga e desliga o escritório automático, sozinho ou junto com a trava', async () => {
    await assertSucceeds(setDoc(policy('sys'), { selfServiceTenants: false, updatedBy: 'sys', updatedAt: serverTimestamp() }));
    await assertSucceeds(setDoc(policy('sys'), {
      acceptNewAccounts: true, selfServiceTenants: true, updatedBy: 'sys', updatedAt: serverTimestamp(),
    }));
    await assertFails(setDoc(policy('sys'), { selfServiceTenants: 'não', updatedBy: 'sys', updatedAt: serverTimestamp() }));
    await assertFails(setDoc(policy('comum'), { selfServiceTenants: false, updatedBy: 'comum', updatedAt: serverTimestamp() }));
  });

  it('o SYSTEM marca e desmarca extensões padrão, uma a uma, sem reescrever a lista', async () => {
    const mark = (uid: string, value: unknown) =>
      setDoc(policy(uid), { defaultExtensions: value, updatedBy: uid, updatedAt: serverTimestamp() }, { merge: true });
    await assertSucceeds(mark('sys', arrayUnion('com.acme.crm')));
    await assertSucceeds(mark('sys', arrayRemove('com.acme.crm')));
    await assertFails(mark('comum', arrayUnion('com.acme.crm')));
    await assertFails(mark('sys', 'com.acme.crm'));
  });

  it('a lista tem teto — cada padrão é uma instalação que a pessoa espera na primeira entrada', async () => {
    const many = Array.from({ length: 31 }, (_, index) => `com.acme.e${index}`);
    await assertFails(setDoc(policy('sys'), { defaultExtensions: many, updatedBy: 'sys', updatedAt: serverTimestamp() }, { merge: true }));
  });

  it('o SYSTEM escolhe o idioma do escritório novo — um código de idioma, ou nenhum', async () => {
    const choose = (uid: string, value: unknown) =>
      setDoc(policy(uid), { defaultLocale: value, updatedBy: uid, updatedAt: serverTimestamp() }, { merge: true });
    await assertSucceeds(choose('sys', 'pt-BR'));
    await assertSucceeds(choose('sys', null));
    await assertFails(choose('comum', 'pt-BR'));
    await assertFails(choose('sys', 'Português'));
    await assertFails(choose('sys', 42));
  });

  it('os outros documentos de system/ continuam fechados, até ao SYSTEM', async () => {
    await assertFails(getDoc(doc(asUser(env, 'sys'), 'system/bootstrap')));
  });
});

describe('registrationRefusals', () => {
  it('quem foi recusado lê a própria recusa — inclusive a que ainda não existe', async () => {
    await assertSucceeds(getDoc(doc(asUser(env, 'recusado'), 'registrationRefusals/recusado')));
    await assertSucceeds(getDoc(doc(asUser(env, 'novo'), 'registrationRefusals/novo')));
  });

  it('ninguém lê a recusa de outro, e ninguém a escreve pelo navegador', async () => {
    await assertFails(getDoc(doc(asUser(env, 'sys'), 'registrationRefusals/recusado')));
    await assertFails(setDoc(doc(asUser(env, 'novo'), 'registrationRefusals/novo'), { email: 'x' }));
  });
});
