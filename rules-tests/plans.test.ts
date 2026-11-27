import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { Timestamp, addDoc, arrayRemove, arrayUnion, collection, deleteDoc, doc, getDoc, getDocs, serverTimestamp, setDoc, updateDoc, type Firestore } from 'firebase/firestore';
import { getMetadata, ref, uploadString, type FirebaseStorage } from 'firebase/storage';
import { TENANT, asUser, seed, testEnv } from './helpers';

/**
 * O teto do PLANO (#24). A materialização grava `!<permissão>` na mesma lista de `permissions`, e as
 * regras a leem ANTES do curinga: é o que faz o plano alcançar o dono, sem custar leitura nenhuma.
 */
let env: RulesTestEnvironment;

const SCREEN = { titleSingular: 'Pet', titlePlural: 'Pets', fields: [], hasDocuments: true, hasNotes: true };
const FILE = `tenants/${TENANT}/pet1/r1/1700000000_foto.png`;

beforeAll(async () => { env = await testEnv(); });
afterAll(async () => { await env.cleanup(); });

beforeEach(async () => {
  await env.clearFirestore();
  await env.clearStorage();
  await seed(env, {
    users: { dono: {}, ana: {}, sys: { role: 'SYSTEM' } },
    owners: { [TENANT]: 'dono' },
    members: {
      [TENANT]: {
        // O dono como a materialização o grava num plano que nega a escrita de Pets — já convertido
        // (#41): negar editar nega também anexar, anotar e etiquetar.
        dono: ['*', '!pet1.create', '!pet1.update', '!pet1.attach', '!pet1.annotate', '!pet1.tag'],
        ana: ['pet1.read', '!pet1.create'],
        // O SYSTEM que também é membro carrega a mesma negação — e passa por cima dela.
        sys: ['*', '!pet1.create'],
      },
    },
    screens: { [TENANT]: { pet1: SCREEN } },
    records: { [TENANT]: { 'pet1/r1': { nome: 'Rex' } } },
    root: { 'plans/starter': { name: 'Starter', memberLimit: 1, deniedPermissions: ['pet1.create'], archived: false } },
  });
  await env.withSecurityRulesDisabled(async (context) => {
    await uploadString(ref(context.storage() as unknown as FirebaseStorage, FILE), 'png');
  });
});

const pets = (uid: string) => collection(asUser(env, uid), `tenants/${TENANT}/pet1`);
const pet = (uid: string) => doc(asUser(env, uid), `tenants/${TENANT}/pet1/r1`);
const storageOf = (uid: string) => env.authenticatedContext(uid).storage() as unknown as FirebaseStorage;

describe('o teto do plano nas regras do Firestore', () => {
  it('o DONO perde o que o plano nega, e mantém o resto do curinga', async () => {
    await assertFails(addDoc(pets('dono'), { nome: 'Bob' }));
    await assertFails(updateDoc(pet('dono'), { nome: 'Rex II' }));
    await assertSucceeds(getDoc(pet('dono')));
    await assertSucceeds(deleteDoc(pet('dono')));
  });

  it('o dono SEM conjunto materializado passa pelo `ownerId`, como antes', async () => {
    await seed(env, { members: { [TENANT]: { dono: [] } } });
    await assertSucceeds(addDoc(pets('dono'), { nome: 'Bob' }));
  });

  it('o membro com a permissão negada não grava', async () => {
    await assertFails(addDoc(pets('ana'), { nome: 'Bob' }));
    await assertSucceeds(getDoc(pet('ana')));
  });

  it('o SYSTEM nunca é alcançado pelo plano', async () => {
    await assertSucceeds(addDoc(pets('sys'), { nome: 'Bob' }));
  });

  it('ninguém carimba a digital do plano do próprio documento de membro', async () => {
    await seed(env, { members: { [TENANT]: { ana: ['pet1.read', 'members.manage'] } } });
    const self = doc(asUser(env, 'ana'), `tenants/${TENANT}/members/ana`);
    await assertFails(updateDoc(self, { permissionsPlan: '' }));
  });
});

describe('o teto do plano nas regras do Storage', () => {
  it('o dono não envia arquivo onde o plano nega a escrita, e continua lendo', async () => {
    await assertFails(uploadString(ref(storageOf('dono'), `tenants/${TENANT}/pet1/r1/1700000001_x.png`), 'x'));
    await assertSucceeds(getMetadata(ref(storageOf('dono'), FILE)));
  });
});

/**
 * #41: anexar, anotar e etiquetar são ações MENORES contidas em `update`, e não dependentes dela. O plano
 * convertido nega as três; o `SYSTEM` que libera uma delas num plano que nega editar é atendido — é o
 * "bloqueia editar, deixa completar" das #35–#37, agora também no teto.
 */
describe('o teto do plano sobre anexar, anotar e etiquetar (#41)', () => {
  const note = (uid: string) => doc(asUser(env, uid), `tenants/${TENANT}/pet1/r1/notes/n-${uid}`);
  const newNote = (uid: string) => ({
    title: 'Contato', text: 'texto', createdBy: uid, createdByName: uid, createdAt: serverTimestamp(),
  });
  const releaseCompleting = () => seed(env, {
    members: { [TENANT]: { dono: ['*', '!pet1.create', '!pet1.update'] } },
  });

  it('o plano que nega editar nega também a nota do dono', async () => {
    await assertFails(setDoc(note('dono'), newNote('dono')));
  });

  it('liberado o anexar num plano que nega editar, o dono envia o arquivo', async () => {
    await releaseCompleting();
    await assertSucceeds(uploadString(ref(storageOf('dono'), `tenants/${TENANT}/pet1/r1/1700000002_y.png`), 'y'));
  });

  it('liberado o anotar num plano que nega editar, o dono escreve a nota — e continua sem alterar o registro', async () => {
    await releaseCompleting();
    await assertSucceeds(setDoc(note('dono'), newNote('dono')));
    await assertFails(updateDoc(pet('dono'), { nome: 'Rex II' }));
  });
});

describe('a coleção de planos', () => {
  const plan = (uid: string, id = 'starter') => doc(asUser(env, uid), `plans/${id}`);
  const valid = (uid: string) => ({
    name: 'Pro',
    memberLimit: 10,
    deniedPermissions: [],
    archived: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    updatedBy: uid,
  });

  it('qualquer conta lê um plano pelo id — o navegador precisa do teto e do nome', async () => {
    await assertSucceeds(getDoc(plan('ana')));
  });

  it('só o SYSTEM lista os planos', async () => {
    await assertFails(getDocs(collection(asUser(env, 'dono'), 'plans')));
    await assertSucceeds(getDocs(collection(asUser(env, 'sys'), 'plans')));
  });

  it('só o SYSTEM grava e exclui', async () => {
    await assertFails(setDoc(plan('dono', 'pro'), valid('dono')));
    await assertSucceeds(setDoc(plan('sys', 'pro'), valid('sys')));
    await assertFails(deleteDoc(plan('dono')));
    await assertSucceeds(deleteDoc(plan('sys')));
  });

  it('o SYSTEM grava as conversões que o plano já recebeu (#41), sempre como lista', async () => {
    await assertSucceeds(setDoc(plan('sys', 'pro'), { ...valid('sys'), accessUpgrades: ['contained-record-actions'] }));
    await assertFails(setDoc(plan('sys', 'pro'), { ...valid('sys'), accessUpgrades: 'contained-record-actions' }));
    await assertFails(setDoc(plan('dono', 'pro'), { ...valid('dono'), accessUpgrades: [] }));
  });

  it('limite abaixo de 1 e campo desconhecido são recusados', async () => {
    await assertFails(setDoc(plan('sys', 'pro'), { ...valid('sys'), memberLimit: 0 }));
    await assertFails(setDoc(plan('sys', 'pro'), { ...valid('sys'), price: 10 }));
    await assertSucceeds(setDoc(plan('sys', 'pro'), { ...valid('sys'), memberLimit: null }));
  });
});

describe('o plano padrão do escritório novo', () => {
  it('o SYSTEM grava `defaultPlanId` em `system/registration`', async () => {
    const registration = doc(asUser(env, 'sys'), 'system/registration');
    await assertSucceeds(setDoc(registration, { defaultPlanId: 'starter', updatedBy: 'sys', updatedAt: serverTimestamp() }, { merge: true }));
    await assertSucceeds(setDoc(registration, { defaultPlanId: null, updatedBy: 'sys', updatedAt: serverTimestamp() }, { merge: true }));
  });
});

describe('a janela de instalação das extensões padrão (#28)', () => {
  const withWindow = async (untilMs: number) => {
    await env.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore() as unknown as Firestore;
      await updateDoc(doc(db, `tenants/${TENANT}/members/dono`), { planDeferredUntil: Timestamp.fromMillis(untilMs) });
      await setDoc(doc(db, `tenants/${TENANT}/extension_onboarding/defaults`), {
        pending: ['com.acme.crm'], failed: [], stagedAt: Timestamp.fromMillis(1), startedAt: Timestamp.fromMillis(2),
      });
    });
  };
  const onboarding = (uid: string) => doc(asUser(env, uid), `tenants/${TENANT}/extension_onboarding/defaults`);

  it('dentro da janela, o dono grava o que o plano nega', async () => {
    await withWindow(Date.now() + 60 * 60 * 1000);
    await assertSucceeds(addDoc(pets('dono'), { nome: 'Bob' }));
  });

  it('com a janela vencida, o plano volta a negar sozinho', async () => {
    await withWindow(Date.now() - 1000);
    await assertFails(addDoc(pets('dono'), { nome: 'Bob' }));
  });

  it('o Storage segue a mesma janela', async () => {
    await withWindow(Date.now() + 60 * 60 * 1000);
    // Nome próprio: a limpeza do Storage entre os testes não garante o caminho livre, e a regra de envio
    // exige que o arquivo ainda não exista.
    await assertSucceeds(uploadString(ref(storageOf('dono'), `tenants/${TENANT}/pet1/r1/1700000003_janela.png`), 'x'));
  });

  it('o navegador só tira itens da lista — nunca devolve, nem mexe no começo', async () => {
    await withWindow(Date.now() + 60 * 60 * 1000);
    await assertFails(updateDoc(onboarding('dono'), { pending: arrayUnion('com.acme.outra') }));
    await assertFails(updateDoc(onboarding('dono'), { startedAt: Timestamp.now() }));
    await assertSucceeds(updateDoc(onboarding('dono'), { pending: arrayRemove('com.acme.crm'), updatedAt: serverTimestamp() }));
  });

  it('ninguém grava o prazo da janela no próprio documento de membro', async () => {
    await seed(env, { members: { [TENANT]: { ana: ['pet1.read', 'members.manage'] } } });
    const self = doc(asUser(env, 'ana'), `tenants/${TENANT}/members/ana`);
    await assertFails(updateDoc(self, { planDeferredUntil: Timestamp.fromMillis(Date.now() + 60_000) }));
  });
});
