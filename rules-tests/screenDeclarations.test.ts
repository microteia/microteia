import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { addDoc, collection, deleteDoc, doc, getDocs, updateDoc } from 'firebase/firestore';
import { TENANT, asUser, seed, testEnv } from './helpers';

/**
 * O que a TELA declara e que continua valendo por cima das permissões: a autoria como posse
 * (`authorCanDelete`) e o campo que qualquer membro grava (`memberWritableFields`). Nenhum dos dois
 * fala de papel — falam de campo e de autoria —, e por isso sobreviveram à saída do `writeRoles`.
 */
let env: RulesTestEnvironment;

beforeAll(async () => { env = await testEnv(); });
afterAll(async () => { await env.cleanup(); });

beforeEach(async () => {
  await env.clearFirestore();
  await seed(env, {
    users: { autor: {}, outro: {}, leitor: {} },
    owners: { [TENANT]: 'dono' },
    members: {
      [TENANT]: {
        // Autor e outro escrevem no mural, mas NENHUM dos dois pode excluir.
        autor: ['mural.read', 'mural.create', 'mural.update'],
        outro: ['mural.read', 'mural.create', 'mural.update'],
        leitor: ['mural.read'],
      },
    },
    screens: {
      [TENANT]: {
        mural: {
          titleSingular: 'Recado',
          titlePlural: 'Mural',
          fields: [],
          authorCanDelete: true,
          memberWritableFields: ['likedBy'],
        },
      },
    },
    lookups: { [TENANT]: ['muralCategorias'] },
    records: { [TENANT]: { 'mural/r1': { texto: 'oi', createdBy: 'autor', likedBy: [] } } },
  });
});

const post = (uid: string) => doc(asUser(env, uid), `tenants/${TENANT}/mural/r1`);

describe('`authorCanDelete` — onde a autoria é a posse', () => {
  it('o AUTOR exclui o que escreveu, mesmo sem `mural.delete`', async () => {
    await assertSucceeds(deleteDoc(post('autor')));
  });

  it('quem escreve no mural NÃO exclui o recado alheio', async () => {
    await assertFails(deleteDoc(post('outro')));
  });

  it('quem só lê não exclui nada', async () => {
    await assertFails(deleteDoc(post('leitor')));
  });
});

describe('`memberWritableFields` — o "por usuário" de um mural', () => {
  it('quem só LÊ marca o campo declarado no recado alheio', async () => {
    await assertSucceeds(updateDoc(post('leitor'), { likedBy: ['leitor'] }));
  });

  it('mas não toca em nenhum campo fora da lista', async () => {
    await assertFails(updateDoc(post('leitor'), { texto: 'reescrevi' }));
    await assertFails(updateDoc(post('leitor'), { likedBy: ['leitor'], texto: 'reescrevi' }));
  });
});

describe('lista de opções é VOCABULÁRIO', () => {
  it('qualquer membro LÊ as opções, sem permissão própria da coleção', async () => {
    await assertSucceeds(getDocs(collection(asUser(env, 'leitor'), `tenants/${TENANT}/muralCategorias`)));
  });

  it('mas GRAVAR nelas exige a permissão da coleção', async () => {
    const opcoes = collection(asUser(env, 'leitor'), `tenants/${TENANT}/muralCategorias`);
    await assertFails(addDoc(opcoes, { label: 'Nova' }));

    await seed(env, { members: { [TENANT]: { leitor: ['mural.read', 'muralCategorias.create'] } } });
    await assertSucceeds(addDoc(collection(asUser(env, 'leitor'), `tenants/${TENANT}/muralCategorias`), { label: 'Nova' }));
  });
});
