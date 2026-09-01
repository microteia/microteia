import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, setDoc, updateDoc } from 'firebase/firestore';
import { OTHER_TENANT, TENANT, asUser, seed, testEnv } from './helpers';

let env: RulesTestEnvironment;

beforeAll(async () => { env = await testEnv(); });
afterAll(async () => { await env.cleanup(); });

beforeEach(async () => {
  await env.clearFirestore();
  await seed(env, {
    users: { gestor: {}, comum: {}, dono: {}, forasteiro: {} },
    owners: { [TENANT]: 'dono', [OTHER_TENANT]: 'outro-dono' },
    members: {
      [TENANT]: {
        gestor: ['roles.manage', 'members.manage'],
        comum: ['pet1.read'],
        dono: [],
      },
      [OTHER_TENANT]: { forasteiro: ['roles.manage', 'members.manage'] },
    },
    roles: {
      [TENANT]: {
        financeiro: { name: 'Financeiro', permissions: ['pet1.read'], system: false },
        protegido: { name: 'Sistema', permissions: [], system: true },
      },
    },
  });
});

const roles = (uid: string) => collection(asUser(env, uid), `tenants/${TENANT}/roles`);
const role = (uid: string, id: string) => doc(asUser(env, uid), `tenants/${TENANT}/roles/${id}`);
const member = (uid: string, target: string) => doc(asUser(env, uid), `tenants/${TENANT}/members/${target}`);

describe('perfis de acesso', () => {
  /**
   * TODO membro lê, e isso não é frouxidão: cada navegador resolve as próprias permissões a partir
   * daqui. Sem a leitura, ninguém saberia o que pode fazer.
   */
  it('qualquer membro LÊ os perfis', async () => {
    await assertSucceeds(getDocs(roles('comum')));
    await assertSucceeds(getDoc(role('comum', 'financeiro')));
  });

  it('quem não é membro não lê', async () => {
    await assertFails(getDocs(roles('forasteiro')));
  });

  it('só quem tem `roles.manage` cria, altera e exclui', async () => {
    await assertSucceeds(addDoc(roles('gestor'), { name: 'Novo', permissions: [], system: false }));
    await assertSucceeds(updateDoc(role('gestor', 'financeiro'), { permissions: ['pet1.read', 'pet1.create'] }));
    await assertSucceeds(deleteDoc(role('gestor', 'financeiro')));
  });

  it('membro comum não cria nem altera perfil', async () => {
    await assertFails(addDoc(roles('comum'), { name: 'Meu', permissions: [], system: false }));
    await assertFails(updateDoc(role('comum', 'financeiro'), { permissions: [] }));
    await assertFails(deleteDoc(role('comum', 'financeiro')));
  });

  it('o perfil PROTEGIDO não é alterável nem excluível, nem por quem gerencia', async () => {
    await assertFails(updateDoc(role('gestor', 'protegido'), { name: 'Outro' }));
    await assertFails(deleteDoc(role('gestor', 'protegido')));
  });

  it('um perfil não NASCE protegido pelo cliente', async () => {
    await assertFails(addDoc(roles('gestor'), { name: 'Falso', permissions: [], system: true }));
  });

  it('um perfil comum não VIRA protegido', async () => {
    await assertFails(updateDoc(role('gestor', 'financeiro'), { system: true }));
  });

  it('o DONO gerencia perfis sem nada materializado', async () => {
    await assertSucceeds(addDoc(roles('dono'), { name: 'Do dono', permissions: [], system: false }));
  });

  it('perfil de outro escritório é inalcançável', async () => {
    const la = doc(asUser(env, 'gestor'), `tenants/${OTHER_TENANT}/roles/financeiro`);
    await assertFails(setDoc(la, { name: 'Invasão', permissions: [], system: false }));
  });
});

describe('membros — o campo que o cliente NUNCA escreve', () => {
  it('quem tem `members.manage` atribui perfis', async () => {
    await assertSucceeds(updateDoc(member('gestor', 'comum'), { roleIds: ['financeiro'] }));
  });

  /**
   * `permissions` é o conjunto materializado que as próprias regras leem. Fosse editável pelo
   * cliente, bastaria uma escrita no próprio documento para se conceder qualquer coisa — a fechadura
   * abrindo com a chave que ela guarda.
   */
  it('NINGUÉM escreve `permissions` — nem quem gerencia membros', async () => {
    await assertFails(updateDoc(member('gestor', 'comum'), { permissions: ['*'] }));
    await assertFails(updateDoc(member('gestor', 'gestor'), { permissions: ['*'] }));
  });

  it('nem escondido no meio de uma alteração legítima', async () => {
    await assertFails(updateDoc(member('gestor', 'comum'), { roleIds: ['financeiro'], permissions: ['*'] }));
  });

  /**
   * `permissionsCatalog` é a digital do catálogo com que aquele conjunto foi composto. Quem pudesse
   * carimbá-la à mão diria que o conjunto está em dia, e a recomposição que o corrigiria nunca mais
   * seria pedida — o conjunto velho ficaria velho para sempre, em silêncio.
   */
  it('NINGUÉM escreve `permissionsCatalog` — o carimbo vale tanto quanto o conjunto', async () => {
    await assertFails(updateDoc(member('gestor', 'comum'), { permissionsCatalog: 'inventada' }));
    await assertFails(updateDoc(member('comum', 'comum'), { permissionsCatalog: 'inventada' }));
    await assertFails(updateDoc(member('gestor', 'comum'), { roleIds: ['financeiro'], permissionsCatalog: 'inventada' }));
  });

  it('o próprio membro não se concede nada', async () => {
    await assertFails(updateDoc(member('comum', 'comum'), { permissions: ['*'] }));
    await assertFails(updateDoc(member('comum', 'comum'), { roleIds: ['financeiro'] }));
  });

  it('membro não é criado nem excluído pelo cliente — as callables cuidam do limite', async () => {
    await assertFails(setDoc(member('gestor', 'novo'), { userId: 'novo', tenantId: TENANT }));
    await assertFails(deleteDoc(member('gestor', 'comum')));
  });

  it('qualquer membro lê a lista de membros', async () => {
    await assertSucceeds(getDocs(collection(asUser(env, 'comum'), `tenants/${TENANT}/members`)));
  });
});
