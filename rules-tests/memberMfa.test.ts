import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { addDoc, collection, doc, getDoc, getDocs, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';
import { getMetadata, ref, uploadString, type FirebaseStorage } from 'firebase/storage';
import { OTHER_TENANT, TENANT, seed, testEnv } from './helpers';

/**
 * O segundo fator nas regras (EV-07). A exigência mora no documento de membro (`mfa`), materializada
 * pelo servidor; a prova mora na SESSÃO (`mfaAt`, a claim do token aberto pelo servidor). Ler exige ter
 * provado; gravar exige ter provado há menos de `maxAgeSeconds`. Sem `mfa` no documento, nada muda.
 */
let env: RulesTestEnvironment;

const SCREEN = { titleSingular: 'Pet', titlePlural: 'Pets', fields: [] };
const HOUR = 3600;
const FILE = `tenants/${TENANT}/pet1/r1/1700000000_laudo.pdf`;

const now = () => Math.floor(Date.now() / 1000);

/** A sessão: sem `mfaAt` é a aberta só com a senha; com ele, a que o servidor abriu depois do código. */
const as = (uid: string, mfaAt?: number): Firestore =>
  env.authenticatedContext(uid, mfaAt === undefined ? {} : { mfaAt }).firestore() as unknown as Firestore;
const storageAs = (uid: string, mfaAt?: number): FirebaseStorage =>
  env.authenticatedContext(uid, mfaAt === undefined ? {} : { mfaAt }).storage() as unknown as FirebaseStorage;

beforeAll(async () => { env = await testEnv(); });
afterAll(async () => { await env.cleanup(); });

beforeEach(async () => {
  await env.clearFirestore();
  await env.clearStorage();
  await seed(env, {
    users: { livre: {}, fiscal: {}, dono: {}, gestor: {}, sys: { role: 'SYSTEM' } },
    owners: { [TENANT]: 'dono' },
    members: {
      [TENANT]: {
        livre: ['pet1.read', 'pet1.create'],
        fiscal: ['pet1.read', 'pet1.create'],
        dono: ['*'],
        gestor: ['members.manage'],
        sys: ['pet1.read', 'pet1.create'],
      },
    },
    screens: { [TENANT]: { pet1: SCREEN } },
    records: { [TENANT]: { 'pet1/r1': { nome: 'Rex' } } },
  });
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore() as unknown as Firestore;
    for (const uid of ['fiscal', 'dono', 'sys']) {
      await updateDoc(doc(db, `tenants/${TENANT}/members/${uid}`), { mfa: { maxAgeSeconds: HOUR } });
    }
    await uploadString(ref(context.storage() as unknown as FirebaseStorage, FILE), 'pdf');
  });
});

const pet = (db: Firestore) => doc(db, `tenants/${TENANT}/pet1/r1`);
const pets = (db: Firestore) => collection(db, `tenants/${TENANT}/pet1`);

describe('quem a política não alcança', () => {
  it('lê e grava como sempre, sem claim nenhuma', async () => {
    await assertSucceeds(getDoc(pet(as('livre'))));
    await assertSucceeds(addDoc(pets(as('livre')), { nome: 'Bidu' }));
  });
});

describe('quem a política alcança', () => {
  it('a sessão só com a senha não lê nem grava nada do escritório', async () => {
    await assertFails(getDoc(pet(as('fiscal'))));
    await assertFails(getDocs(pets(as('fiscal'))));
    await assertFails(getDocs(collection(as('fiscal'), `tenants/${TENANT}/roles`)));
    await assertFails(addDoc(pets(as('fiscal')), { nome: 'Bidu' }));
  });

  it('mas lê o próprio escritório e o próprio documento de membro — é por eles que a tela pede o código', async () => {
    await assertSucceeds(getDoc(doc(as('fiscal'), `tenants/${TENANT}`)));
    await assertSucceeds(getDoc(doc(as('fiscal'), `tenants/${TENANT}/members/fiscal`)));
    await assertFails(getDoc(doc(as('fiscal'), `tenants/${TENANT}/members/livre`)));
  });

  it('com a prova recente, lê e grava', async () => {
    await assertSucceeds(getDoc(pet(as('fiscal', now() - 60))));
    await assertSucceeds(addDoc(pets(as('fiscal', now() - 60)), { nome: 'Bidu' }));
  });

  it('com a prova vencida, continua LENDO — e não grava até provar de novo', async () => {
    const stale = now() - HOUR - 60;
    await assertSucceeds(getDoc(pet(as('fiscal', stale))));
    await assertSucceeds(getDocs(pets(as('fiscal', stale))));
    await assertFails(addDoc(pets(as('fiscal', stale)), { nome: 'Bidu' }));
    await assertFails(setDoc(pet(as('fiscal', stale)), { nome: 'Rex II' }));
  });

  it('o curinga do DONO não pula o fator', async () => {
    await assertFails(addDoc(pets(as('dono')), { nome: 'Bidu' }));
    await assertFails(getDoc(pet(as('dono'))));
    await assertSucceeds(addDoc(pets(as('dono', now())), { nome: 'Bidu' }));
  });

  it('o administrador GLOBAL não é alcançado pela política do escritório', async () => {
    await assertSucceeds(addDoc(pets(as('sys')), { nome: 'Bidu' }));
  });
});

describe('a exigência e o fator são do servidor', () => {
  it('ninguém apaga a exigência do documento de membro — nem quem gerencia membros', async () => {
    await assertFails(updateDoc(doc(as('gestor'), `tenants/${TENANT}/members/fiscal`), { mfa: null }));
    await assertSucceeds(updateDoc(doc(as('gestor'), `tenants/${TENANT}/members/fiscal`), { roleIds: [] }));
  });

  it('a política e o fator não se leem nem se gravam do cliente — nem pelo dono com a prova', async () => {
    const owner = as('dono', now());
    await assertFails(getDoc(doc(owner, `memberMfaPolicies/${TENANT}`)));
    await assertFails(setDoc(doc(owner, `memberMfaPolicies/${TENANT}`), { enabled: false }));
    await assertFails(getDoc(doc(as('fiscal', now()), 'mfaFactors/fiscal')));
    await assertFails(setDoc(doc(as('fiscal', now()), 'mfaFactors/fiscal'), { secret: 'ABC' }));
  });
});

describe('Storage', () => {
  it('a sessão só com a senha não lê o arquivo; com a prova, lê', async () => {
    await assertFails(getMetadata(ref(storageAs('fiscal'), FILE)));
    await assertSucceeds(getMetadata(ref(storageAs('fiscal', now()), FILE)));
    await assertSucceeds(getMetadata(ref(storageAs('livre'), FILE)));
  });

  it('com a prova vencida, lê e não envia', async () => {
    const stale = now() - HOUR - 60;
    await assertSucceeds(getMetadata(ref(storageAs('fiscal', stale), FILE)));
    await assertFails(uploadString(ref(storageAs('fiscal', stale), `tenants/${TENANT}/pet1/r1/1700000001_x.pdf`), 'x'));
    await assertSucceeds(uploadString(ref(storageAs('fiscal', now()), `tenants/${TENANT}/pet1/r1/1700000002_x.pdf`), 'x'));
  });
});

/**
 * A conta SYSTEM que é DONA do escritório (EV-36). O `mfa` é materializado no documento dela como no de
 * qualquer um — o curinga do dono entra em toda política por permissão —, e quem a dispensa é a
 * pergunta. Antes, `can()` a dispensava e `isTenantMember` não: ela lia o sino e não marcava nada.
 */
describe('a conta SYSTEM dona do escritório, com a política ligada', () => {
  const PLUGIN = 'com.acme.crm';
  const SYS_INBOX = `tenants/${OTHER_TENANT}/notification_inbox/n1`;
  const OWNER_INBOX = `tenants/${TENANT}/notification_inbox/n2`;
  const logo = (tenantId: string, name: string) => `tenants/${tenantId}/branding/logo/${name}.png`;

  beforeEach(async () => {
    await seed(env, {
      owners: { [OTHER_TENANT]: 'sys' },
      members: { [OTHER_TENANT]: { sys: ['*'] } },
      records: { [OTHER_TENANT]: { [`installed_extensions/${PLUGIN}`]: { source: 'public', active: true } } },
      root: { [`extension_stats/${PLUGIN}`]: { installs: 1, ratingCount: 0, ratingSum: 0 } },
    });
    await env.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore() as unknown as Firestore;
      await updateDoc(doc(db, `tenants/${OTHER_TENANT}/members/sys`), { mfa: { maxAgeSeconds: HOUR } });
      const unread = { title: '@ext/title', message: 'texto', params: {}, link: '', read: false, readAt: null };
      await setDoc(doc(db, SYS_INBOX), { ...unread, recipientId: 'sys' });
      await setDoc(doc(db, OWNER_INBOX), { ...unread, recipientId: 'dono' });
    });
  });

  it('marca a própria notificação como lida sem o código — e continua sem poder reescrevê-la', async () => {
    await assertSucceeds(updateDoc(doc(as('sys'), SYS_INBOX), { read: true, readAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(as('sys'), SYS_INBOX), { title: 'forjado' }));
    await assertFails(updateDoc(doc(as('sys'), OWNER_INBOX), { read: true }));
  });

  it('o dono que NÃO é SYSTEM continua precisando do código para marcar', async () => {
    await assertFails(updateDoc(doc(as('dono'), OWNER_INBOX), { read: true }));
    await assertFails(updateDoc(doc(as('dono', now() - HOUR - 60), OWNER_INBOX), { read: true }));
    await assertSucceeds(updateDoc(doc(as('dono', now()), OWNER_INBOX), { read: true }));
  });

  it('vota na extensão do próprio escritório sem o código; quem a política alcança, não', async () => {
    const ballot = { stars: 5, tenantId: OTHER_TENANT, updatedAt: serverTimestamp() };
    await assertSucceeds(setDoc(doc(as('sys'), `extension_stats/${PLUGIN}/ratings/sys`), ballot));
    await assertFails(setDoc(doc(as('fiscal'), `extension_stats/${PLUGIN}/ratings/fiscal`), { ...ballot, tenantId: TENANT }));
  });

  it('no Storage, troca o logo do escritório sem o código; o dono que não é SYSTEM, só com ele', async () => {
    await assertSucceeds(uploadString(ref(storageAs('sys'), logo(OTHER_TENANT, 'a')), 'png', 'raw', { contentType: 'image/png' }));
    await assertFails(uploadString(ref(storageAs('dono'), logo(TENANT, 'b')), 'png', 'raw', { contentType: 'image/png' }));
    await assertSucceeds(uploadString(ref(storageAs('dono', now()), logo(TENANT, 'c')), 'png', 'raw', { contentType: 'image/png' }));
  });

  it('rebaixada a USER, a mesma conta volta a ser cobrada no instante — a exigência nunca saiu do documento', async () => {
    await env.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore() as unknown as Firestore, 'users/sys'), { role: 'USER' });
    });
    await assertFails(updateDoc(doc(as('sys'), SYS_INBOX), { read: true }));
    await assertFails(addDoc(collection(as('sys'), `tenants/${OTHER_TENANT}/roles`), { name: 'x' }));
    await assertSucceeds(updateDoc(doc(as('sys', now()), SYS_INBOX), { read: true }));
  });
});
