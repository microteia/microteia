import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { deleteDoc, deleteField, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { OTHER_TENANT, TENANT, asUser, seed, testEnv } from './helpers';

/**
 * O texto do portal editado pelo escritório. Quem lê e grava é quem tem `portal.content` — não quem
 * administra o portal, e muito menos o convidado, que recebe o texto pelo servidor. A referência gravada
 * tem de ser a do id: senão dois documentos disputariam a mesma chave, e o que vale dependeria da ordem.
 */
let env: RulesTestEnvironment;

const LAW_ID = 'br.gov.dte.legislacao:portal.legislacao';
const LAW = '@br.gov.dte.legislacao/portal.legislacao';

beforeAll(async () => { env = await testEnv(); });
afterAll(async () => { await env.cleanup(); });

beforeEach(async () => {
  await env.clearFirestore();
  await seed(env, {
    users: { juridico: {}, gestor: {}, membro: {}, deFora: {} },
    owners: { [TENANT]: 'dono', [OTHER_TENANT]: 'outroDono' },
    members: {
      [TENANT]: { juridico: ['portal.content'], gestor: ['portal.manage'], membro: ['vendas.read'] },
      [OTHER_TENANT]: { deFora: ['portal.content'] },
    },
    records: {
      [TENANT]: { [`portalTexts/${LAW_ID}`]: { ref: LAW, texts: { 'pt-BR': 'Lei' } } },
    },
  });
});

const text = (uid: string, id = LAW_ID, tenantId: string = TENANT) =>
  doc(asUser(env, uid), `tenants/${tenantId}/portalTexts/${id}`);

describe('o texto do portal editado pelo escritório', () => {
  it('quem tem portal.content lê, grava, tira um idioma e volta ao texto do pacote', async () => {
    await assertSucceeds(getDoc(text('juridico')));
    await assertSucceeds(setDoc(text('juridico'), { ref: LAW, texts: { en: 'Law' }, updatedBy: 'juridico' }, { merge: true }));
    await assertSucceeds(updateDoc(text('juridico'), { 'texts.en': deleteField() }));
    await assertSucceeds(updateDoc(text('juridico'), { deletedBy: 'juridico', deletedByName: 'J', deletedByPhotoURL: '' }));
    await assertSucceeds(deleteDoc(text('juridico')));
  });

  it('quem administra o portal, o membro comum e o de outro escritório não leem nem gravam', async () => {
    for (const uid of ['gestor', 'membro', 'deFora']) {
      await assertFails(getDoc(text(uid)));
      await assertFails(setDoc(text(uid), { ref: LAW, texts: { 'pt-BR': 'Outra' } }));
      await assertFails(deleteDoc(text(uid)));
    }
  });

  it('a referência gravada é a do id, e o documento não leva campo de fora', async () => {
    await assertFails(setDoc(text('juridico', 'br.gov.dte.legislacao:outra'), { ref: LAW, texts: { 'pt-BR': 'x' } }));
    await assertFails(setDoc(text('juridico'), { ref: LAW, texts: 'Lei' }));
    await assertFails(setDoc(text('juridico'), { ref: LAW, texts: { 'pt-BR': 'x' }, html: '<script>' }));
  });
});
