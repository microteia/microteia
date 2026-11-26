import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { Timestamp, deleteDoc, doc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { ref, uploadString, type FirebaseStorage } from 'firebase/storage';
import { TENANT, asUser, seed, testEnv } from './helpers';

/**
 * Completar o registro sem alterá-lo (#35, #36): `<coleção>.attach` anexa à aba Documentos e
 * `<coleção>.annotate` escreve na aba Notas, sem `<coleção>.update`. Nenhuma das duas altera o registro,
 * compartilha no portal, carimba exclusão nem exclui — e `.update` continua fazendo as duas coisas.
 */
let env: RulesTestEnvironment;

beforeAll(async () => { env = await testEnv(); });
afterAll(async () => { await env.cleanup(); });

const JUST_NOW = (): Timestamp => Timestamp.fromMillis(Date.now() - 60_000);

beforeEach(async () => {
  await env.clearFirestore();
  await env.clearStorage();
  await seed(env, {
    users: { anexador: {}, anotador: {}, editor: {}, leitor: {} },
    owners: { [TENANT]: 'dono' },
    members: {
      [TENANT]: {
        anexador: ['oficios.read', 'oficios.attach'],
        anotador: ['oficios.read', 'oficios.annotate'],
        editor: ['oficios.read', 'oficios.update'],
        leitor: ['oficios.read'],
      },
    },
    screens: {
      [TENANT]: {
        oficios: {
          titleSingular: 'Ofício',
          fields: [],
          hasDocuments: true,
          hasNotes: true,
          editWindow: { minutes: 15 },
        },
      },
    },
    records: {
      [TENANT]: {
        'oficios/o1': { numero: '1/2026', createdAt: JUST_NOW() },
        'oficios/o1/documents/d1': {
          name: 'laudo.pdf',
          url: 'https://example.test/laudo.pdf',
          storagePath: `tenants/${TENANT}/oficios/o1/1700000000_laudo.pdf`,
          createdBy: 'editor',
          createdByName: 'Editor',
          createdAt: JUST_NOW(),
          sha256: 'a'.repeat(64),
        },
        'oficios/o1/notes/n1': { title: 'Nota', text: 'texto', createdBy: 'editor', createdAt: JUST_NOW() },
      },
    },
  });
});

const newDocument = (uid: string) => ({
  name: 'planilha.xlsx',
  url: 'https://example.test/planilha.xlsx',
  storagePath: `tenants/${TENANT}/oficios/o1/1700000001_planilha.xlsx`,
  createdBy: uid,
  createdByName: uid,
  createdAt: serverTimestamp(),
});

const newNote = (uid: string) => ({
  title: 'Contato',
  text: 'Destinatário pediu a planilha em outro formato.',
  createdBy: uid,
  createdByName: uid,
  createdAt: serverTimestamp(),
});

const documentRef = (uid: string, id: string) => doc(asUser(env, uid), `tenants/${TENANT}/oficios/o1/documents/${id}`);
const noteRef = (uid: string, id: string) => doc(asUser(env, uid), `tenants/${TENANT}/oficios/o1/notes/${id}`);
const storageOf = (uid: string) => env.authenticatedContext(uid).storage() as unknown as FirebaseStorage;

describe('`<coleção>.attach` (#35)', () => {
  it('anexa documento e envia o arquivo, sem `.update`', async () => {
    await assertSucceeds(setDoc(documentRef('anexador', 'd2'), newDocument('anexador')));
    await assertSucceeds(uploadString(
      ref(storageOf('anexador'), `tenants/${TENANT}/oficios/o1/1700000001_planilha.xlsx`),
      'x',
    ));
  });

  it('não altera o registro', async () => {
    await assertFails(updateDoc(doc(asUser(env, 'anexador'), `tenants/${TENANT}/oficios/o1`), { numero: '2/2026' }));
  });

  it('não nasce compartilhado nem leva o hash — as condições de sempre', async () => {
    await assertFails(setDoc(documentRef('anexador', 'd3'), { ...newDocument('anexador'), portalShared: true }));
    await assertFails(setDoc(documentRef('anexador', 'd4'), { ...newDocument('anexador'), sha256: 'b'.repeat(64) }));
  });

  it('não compartilha no portal, não carimba exclusão nem exclui', async () => {
    await assertFails(updateDoc(documentRef('anexador', 'd1'), {
      portalShared: true, portalSharedBy: 'anexador', portalSharedAt: serverTimestamp(),
    }));
    await assertFails(updateDoc(documentRef('anexador', 'd1'), {
      deletedBy: 'anexador', deletedByName: 'anexador', deletedByPhotoURL: '',
    }));
    await assertFails(deleteDoc(documentRef('anexador', 'd1')));
  });

  it('não escreve anotação — anexar não é anotar', async () => {
    await assertFails(setDoc(noteRef('anexador', 'n2'), newNote('anexador')));
  });
});

describe('`<coleção>.annotate` (#36)', () => {
  it('escreve anotação sem `.update`', async () => {
    await assertSucceeds(setDoc(noteRef('anotador', 'n2'), newNote('anotador')));
  });

  it('não altera o registro, não exclui anotação nem anexa', async () => {
    await assertFails(updateDoc(doc(asUser(env, 'anotador'), `tenants/${TENANT}/oficios/o1`), { numero: '2/2026' }));
    await assertFails(deleteDoc(noteRef('anotador', 'n1')));
    await assertFails(setDoc(documentRef('anotador', 'd2'), newDocument('anotador')));
    await assertFails(uploadString(
      ref(storageOf('anotador'), `tenants/${TENANT}/oficios/o1/1700000002_x.pdf`),
      'x',
    ));
  });
});

describe('quem já fazia continua fazendo', () => {
  it('`.update` anexa e anota, como antes', async () => {
    await assertSucceeds(setDoc(documentRef('editor', 'd2'), newDocument('editor')));
    await assertSucceeds(setDoc(noteRef('editor', 'n2'), newNote('editor')));
  });

  it('quem só lê não anexa nem anota', async () => {
    await assertFails(setDoc(documentRef('leitor', 'd2'), newDocument('leitor')));
    await assertFails(setDoc(noteRef('leitor', 'n2'), newNote('leitor')));
    await assertFails(uploadString(ref(storageOf('leitor'), `tenants/${TENANT}/oficios/o1/1700000003_x.pdf`), 'x'));
  });
});
