import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import {
  addDoc,
  and,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  or,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type Firestore,
  type QueryFilterConstraint,
} from 'firebase/firestore';
import { deleteObject, getMetadata, ref, uploadString, type FirebaseStorage } from 'firebase/storage';
import { TENANT, asUser, seed, testEnv } from './helpers';

/**
 * A visibilidade por registro (`memberVisibility`) como SEGURANÇA: o membro sem o próprio uid num dos
 * campos declarados, e sem a supervisão, não lê o registro por nenhum caminho do cliente — documento,
 * consulta, anotações, documentos, arquivo — nem grava nele às cegas.
 *
 * As consultas daqui têm a forma EXATA da que o repositório monta (`memberVisibilityClauses`): um `==`
 * e um `array-contains` por campo, num `or()`. É ela que tem de passar, e a sem filtro que tem de cair.
 */
let env: RulesTestEnvironment;

beforeAll(async () => { env = await testEnv(); });
afterAll(async () => { await env.cleanup(); });

const LE = ['respostas.read'];
const ESCREVE = ['respostas.read', 'respostas.create', 'respostas.update', 'respostas.delete'];
const OUTRAS = ['aberta.read', 'quebrada.read', 'torta.read', 'oficios.read'];

beforeEach(async () => {
  await env.clearFirestore();
  await seed(env, {
    users: {
      ana: {}, bia: {}, caio: {}, chefe: {}, fiscal: {}, estranho: {}, desenhista: {}, sigilo: {}, instalador: {},
      sys: { role: 'SYSTEM' },
    },
    owners: { [TENANT]: 'dono' },
    members: {
      [TENANT]: {
        ana: [...ESCREVE, ...OUTRAS],
        bia: [...ESCREVE, ...OUTRAS],
        caio: LE,
        chefe: [...LE, 'respostas.read-all', 'quebrada.read', 'quebrada.read-all', 'torta.read', 'torta.read-all'],
        fiscal: ['oficios.read', 'oficios.supervise'],
        estranho: [],
        desenhista: ['screens.manage'],
        sigilo: ['screens.manage', 'screens.member-visibility'],
        instalador: ['extensions.manage'],
        // Como em produção: o servidor carimba o curinga no documento de membro do dono — e é dele, não
        // de `tenants/{id}.ownerId`, que o Storage tira a resposta (o teto de leituras não comporta as duas).
        dono: ['*'],
      },
    },
    screens: {
      [TENANT]: {
        respostas: {
          titleSingular: 'Resposta',
          fields: [],
          memberWritableFields: ['lidaPor'],
          memberVisibility: { userFields: ['emissor', 'equipe'] },
        },
        oficios: {
          titleSingular: 'Ofício',
          fields: [],
          memberVisibility: { userFields: ['responsavel'], bypassPermission: 'oficios.supervise' },
        },
        quebrada: { titleSingular: 'Quebrada', fields: [], memberVisibility: { userFields: 'emissor' } },
        torta: { titleSingular: 'Torta', fields: [], memberVisibility: 'emissor' },
        aberta: { titleSingular: 'Aberta', fields: [] },
      },
    },
    records: {
      [TENANT]: {
        'respostas/da-ana': { emissor: 'ana', equipe: [], processo: 'p1', lidaPor: [] },
        'respostas/da-equipe': { emissor: 'outro', equipe: ['ana', 'bia'], processo: 'p1', lidaPor: [] },
        'respostas/da-bia': { emissor: 'bia', equipe: [], processo: 'p1', lidaPor: [] },
        'respostas/forjada': { emissor: { ana: true }, equipe: { ana: 'ana' }, processo: 'p2', lidaPor: [] },
        'oficios/da-ana': { responsavel: 'ana' },
        'oficios/da-bia': { responsavel: 'bia' },
        'quebrada/x': { emissor: 'ana' },
        'torta/x': { emissor: 'ana' },
        'aberta/x': { emissor: 'bia' },
      },
    },
  });
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore() as unknown as Firestore;
    await setDoc(doc(db, `tenants/${TENANT}/respostas/da-ana/notes/n1`), { texto: 'nota' });
    await setDoc(doc(db, `tenants/${TENANT}/respostas/da-bia/notes/n1`), { texto: 'nota' });
    await setDoc(doc(db, `tenants/${TENANT}/respostas/da-bia/documents/d1`), { name: 'a.pdf' });
  });
});

const respostas = (uid: string) => collection(asUser(env, uid), `tenants/${TENANT}/respostas`);
const record = (uid: string, path: string) => doc(asUser(env, uid), `tenants/${TENANT}/${path}`);

/** A consulta como o repositório a monta: `==` e `array-contains` por campo. */
const visibleTo = (uid: string, fields: string[]): QueryFilterConstraint =>
  or(...fields.flatMap((field) => [where(field, '==', uid), where(field, 'array-contains', uid)]));

const removeAsAdmin = async (path: string): Promise<void> => {
  await env.withSecurityRulesDisabled(async (context) => {
    await deleteDoc(doc(context.firestore() as unknown as Firestore, `tenants/${TENANT}/${path}`));
  });
};

describe('visibilidade por registro — o documento', () => {
  it('lê quem o campo simples nomeia, e quem o `multi` contém', async () => {
    await assertSucceeds(getDoc(record('ana', 'respostas/da-ana')));
    await assertSucceeds(getDoc(record('ana', 'respostas/da-equipe')));
    await assertSucceeds(getDoc(record('bia', 'respostas/da-equipe')));
  });

  it('quem não é nomeado não lê, ainda que leia a coleção', async () => {
    await assertFails(getDoc(record('ana', 'respostas/da-bia')));
    await assertFails(getDoc(record('caio', 'respostas/da-ana')));
  });

  it('ser nomeado não substitui a permissão da coleção', async () => {
    await seed(env, { records: { [TENANT]: { 'respostas/do-estranho': { emissor: 'estranho', equipe: [] } } } });
    await assertFails(getDoc(record('estranho', 'respostas/do-estranho')));
  });

  it('um mapa com o uid como CHAVE não nomeia ninguém — `in` passaria, `hasAny` não', async () => {
    await assertFails(getDoc(record('ana', 'respostas/forjada')));
  });

  it('sem `bypassPermission`, supervisiona quem tem a derivada `<coleção>.read-all`', async () => {
    await assertSucceeds(getDoc(record('chefe', 'respostas/da-bia')));
  });

  it('com `bypassPermission`, supervisiona quem a tem — e a derivada deixa de valer', async () => {
    await assertSucceeds(getDoc(record('fiscal', 'oficios/da-bia')));
    await seed(env, { members: { [TENANT]: { chefe2: ['oficios.read', 'oficios.read-all'] } } });
    await assertFails(getDoc(record('chefe2', 'oficios/da-bia')));
  });

  it('o DONO e o SYSTEM leem tudo, como em `can()`', async () => {
    await assertSucceeds(getDoc(record('dono', 'respostas/da-bia')));
    await assertSucceeds(getDoc(record('sys', 'respostas/da-bia')));
  });

  it('declaração malformada fecha para quem não supervisiona', async () => {
    await assertFails(getDoc(record('ana', 'quebrada/x')));
    await assertFails(getDoc(record('ana', 'torta/x')));
    await assertSucceeds(getDoc(record('chefe', 'quebrada/x')));
    await assertSucceeds(getDoc(record('chefe', 'torta/x')));
  });

  it('a tela sem declaração continua como sempre', async () => {
    await assertSucceeds(getDoc(record('ana', 'aberta/x')));
    await assertSucceeds(getDocs(query(collection(asUser(env, 'ana'), `tenants/${TENANT}/aberta`), limit(10))));
  });
});

describe('visibilidade por registro — a consulta', () => {
  it('sem o filtro, a consulta de quem não supervisiona é recusada INTEIRA', async () => {
    await assertFails(getDocs(query(respostas('ana'), limit(50))));
  });

  it('com o filtro do repositório, passa e traz só o que a nomeia', async () => {
    const snapshot = await assertSucceeds(getDocs(query(respostas('ana'), visibleTo('ana', ['emissor', 'equipe']), limit(50))));
    expect(snapshot.docs.map((one) => one.id).sort()).toEqual(['da-ana', 'da-equipe']);
  });

  it('o filtro combinado com o do pai (a aba de filhos) também passa', async () => {
    const snapshot = await assertSucceeds(getDocs(query(
      respostas('bia'),
      and(where('processo', '==', 'p1'), visibleTo('bia', ['emissor', 'equipe'])),
      limit(50),
    )));
    expect(snapshot.docs.map((one) => one.id).sort()).toEqual(['da-bia', 'da-equipe']);
  });

  it('o filtro com o uid de OUTRA pessoa é recusado', async () => {
    await assertFails(getDocs(query(respostas('ana'), visibleTo('bia', ['emissor', 'equipe']), limit(50))));
  });

  it('o filtro por um dos campos só também prova', async () => {
    await assertSucceeds(getDocs(query(respostas('ana'), where('equipe', 'array-contains', 'ana'), limit(50))));
    await assertSucceeds(getDocs(query(respostas('ana'), where('emissor', '==', 'ana'), limit(50))));
  });

  it('quem supervisiona consulta sem filtro', async () => {
    const snapshot = await assertSucceeds(getDocs(query(respostas('chefe'), limit(50))));
    expect(snapshot.size).toBe(4);
    await assertSucceeds(getDocs(query(respostas('dono'), limit(50))));
  });
});

describe('visibilidade por registro — gravar', () => {
  it('cria nomeando outra pessoa: o encaminhamento é o caso que a restrição existe para permitir', async () => {
    await assertSucceeds(addDoc(respostas('ana'), { emissor: 'bia', equipe: [], createdAt: serverTimestamp() }));
  });

  it('altera e exclui só o registro que lê', async () => {
    await assertSucceeds(updateDoc(record('ana', 'respostas/da-ana'), { texto: 'novo' }));
    await assertFails(updateDoc(record('ana', 'respostas/da-bia'), { texto: 'novo' }));
    await assertFails(deleteDoc(record('ana', 'respostas/da-bia')));
    await assertSucceeds(deleteDoc(record('ana', 'respostas/da-ana')));
  });

  it('passar o registro a outra pessoa é permitido — e depois disso quem passou não lê mais', async () => {
    await assertSucceeds(updateDoc(record('ana', 'respostas/da-ana'), { emissor: 'bia' }));
    await assertFails(getDoc(record('ana', 'respostas/da-ana')));
    await assertSucceeds(getDoc(record('bia', 'respostas/da-ana')));
  });

  it('os campos de membro não abrem o registro de outra pessoa', async () => {
    await assertFails(updateDoc(record('caio', 'respostas/da-bia'), { lidaPor: ['caio'] }));
    await seed(env, { records: { [TENANT]: { 'respostas/do-caio': { emissor: 'caio', equipe: [], lidaPor: [] } } } });
    await assertSucceeds(updateDoc(record('caio', 'respostas/do-caio'), { lidaPor: ['caio'] }));
  });
});

describe('visibilidade por registro — anotações e documentos', () => {
  it('lê e acrescenta só sob o registro que lê', async () => {
    await assertSucceeds(getDoc(record('ana', 'respostas/da-ana/notes/n1')));
    await assertFails(getDoc(record('ana', 'respostas/da-bia/notes/n1')));
    await assertFails(getDoc(record('ana', 'respostas/da-bia/documents/d1')));
    await assertFails(addDoc(collection(asUser(env, 'ana'), `tenants/${TENANT}/respostas/da-bia/notes`), { texto: 'x' }));
    await assertSucceeds(addDoc(collection(asUser(env, 'ana'), `tenants/${TENANT}/respostas/da-ana/notes`), { texto: 'x' }));
    await assertSucceeds(getDoc(record('chefe', 'respostas/da-bia/documents/d1')));
  });

  it('não apaga o anexo do registro que não lê; o de um registro já excluído, sim — a cascata', async () => {
    await assertFails(deleteDoc(record('ana', 'respostas/da-bia/documents/d1')));
    await removeAsAdmin('respostas/da-bia');
    await assertSucceeds(deleteDoc(record('ana', 'respostas/da-bia/documents/d1')));
    await assertSucceeds(deleteDoc(record('ana', 'respostas/da-bia/notes/n1')));
  });
});

describe('visibilidade por registro — quem muda a declaração', () => {
  const screen = (uid: string, key: string) => doc(asUser(env, uid), `tenants/${TENANT}/screenDefinitions/${key}`);

  it('quem só desenha telas salva a tela sem tocar a declaração', async () => {
    await assertSucceeds(updateDoc(screen('desenhista', 'respostas'), { titleSingular: 'Réplica' }));
  });

  it('quem só desenha telas não a cria, não a afrouxa, não a retira e não exclui a tela que a tem', async () => {
    await assertFails(updateDoc(screen('desenhista', 'aberta'), { memberVisibility: { userFields: ['emissor'] } }));
    await assertFails(updateDoc(screen('desenhista', 'respostas'), { memberVisibility: { userFields: ['emissor', 'equipe', 'leitor'] } }));
    await assertFails(updateDoc(screen('desenhista', 'respostas'), { memberVisibility: null }));
    await assertFails(setDoc(screen('desenhista', 'nova'), { titleSingular: 'Nova', fields: [], memberVisibility: { userFields: ['x'] } }));
    await assertFails(deleteDoc(screen('desenhista', 'respostas')));
    await assertSucceeds(deleteDoc(screen('desenhista', 'aberta')));
  });

  it('`screens.member-visibility` e `extensions.manage` mudam', async () => {
    await assertSucceeds(updateDoc(screen('sigilo', 'respostas'), { memberVisibility: { userFields: ['emissor'] } }));
    await assertSucceeds(updateDoc(screen('instalador', 'oficios'), { memberVisibility: null }));
    await assertSucceeds(deleteDoc(screen('sigilo', 'quebrada')));
  });
});

describe('visibilidade por registro — arquivos', () => {
  const FILE = `tenants/${TENANT}/respostas/da-bia/1700000000_resposta.pdf`;
  const storageOf = (uid: string) => env.authenticatedContext(uid).storage() as unknown as FirebaseStorage;

  beforeEach(async () => {
    await env.clearStorage();
    await env.withSecurityRulesDisabled(async (context) => {
      await uploadString(ref(context.storage() as unknown as FirebaseStorage, FILE), 'pdf');
    });
  });

  it('baixa pelo SDK quem lê o registro; quem não lê, não', async () => {
    await assertSucceeds(getMetadata(ref(storageOf('bia'), FILE)));
    await assertSucceeds(getMetadata(ref(storageOf('chefe'), FILE)));
    await assertSucceeds(getMetadata(ref(storageOf('dono'), FILE)));
    await assertFails(getMetadata(ref(storageOf('ana'), FILE)));
  });

  it('envia ao registro novo, que ainda não existe — como criar', async () => {
    await assertSucceeds(uploadString(ref(storageOf('ana'), `tenants/${TENANT}/respostas/nova/1700000001_x.pdf`), 'x'));
  });

  it('não apaga o arquivo do registro que não lê; o de um registro já excluído, sim', async () => {
    await assertFails(deleteObject(ref(storageOf('ana'), FILE)));
    await removeAsAdmin('respostas/da-bia');
    await assertSucceeds(deleteObject(ref(storageOf('ana'), FILE)));
  });
});
