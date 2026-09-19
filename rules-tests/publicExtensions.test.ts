import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { deleteDoc, doc, getDoc, setDoc } from 'firebase/firestore';
import { OTHER_TENANT, TENANT, asAnonymous, asUser, seed, testEnv } from './helpers';

/**
 * `public_extensions/{domain}` — o catálogo que todo escritório vê, e a única divisão que o define:
 * o que é DECLARAÇÃO o dono publica sozinho; o que traz CÓDIGO só a equipe global publica.
 *
 * A assimetria não é hierarquia, é consequência. Uma extensão sem código instala telas, automações e
 * relatórios — dado que o kernel interpreta. Uma com código roda no navegador de cada membro de cada
 * escritório que a instalar, com acesso ao que aquela pessoa vê. Deixar isso entrar por autosserviço
 * seria dar a qualquer admin de qualquer escritório uma porta para o navegador de todos os outros.
 *
 * A regra lê o pacote que ESTÁ SENDO ESCRITO (`request.resource`), nunca o que já estava: quem tenta
 * acrescentar código a um registro seu é barrado do mesmo jeito que quem tenta publicá-lo assim.
 */
let env: RulesTestEnvironment;

beforeAll(async () => { env = await testEnv(); });
afterAll(async () => { await env.cleanup(); });

const DOMAIN = 'com.acme.crm';

const pkg = (over: Record<string, unknown> = {}) => ({
  manifest: { id: DOMAIN, version: '1.0.0', kernel: '^2.0.0', name: 'CRM' },
  summary: '',
  workflows: [],
  ...over,
});

const withCode = pkg({ views: [{ key: 'k', title: 'K', icon: 'layoutGrid', source: 'export default () => null;' }] });

const record = (over: Record<string, unknown> = {}) => ({
  domain: DOMAIN,
  package: pkg(),
  ownerTenantId: TENANT,
  ownerName: 'Dona',
  ownerPhotoURL: null,
  version: '1.0.0',
  status: 'approved',
  hasCode: false,
  publishedAt: new Date(),
  publishedBy: 'admin',
  ...over,
});

beforeEach(async () => {
  await env.clearFirestore();
  await seed(env, {
    users: { admin: {}, membro: {}, deFora: {}, sistema: { role: 'SYSTEM' } },
    owners: { [TENANT]: 'dono', [OTHER_TENANT]: 'outroDono' },
    members: {
      [TENANT]: { admin: ['extensions.manage'], membro: ['clientes.read'] },
      [OTHER_TENANT]: { deFora: ['extensions.manage'] },
    },
  });
});

const published = (uid: string) => doc(asUser(env, uid), `public_extensions/${DOMAIN}`);

describe('leitura', () => {
  it('qualquer autenticado lê o catálogo — é o que a tela de Extensões lista antes de instalar', async () => {
    await seed(env, { root: { [`public_extensions/${DOMAIN}`]: record() } });
    await assertSucceeds(getDoc(published('membro')));
  });

  it('quem não entrou não lê', async () => {
    await seed(env, { root: { [`public_extensions/${DOMAIN}`]: record() } });
    await assertFails(getDoc(doc(asAnonymous(env), `public_extensions/${DOMAIN}`)));
  });
});

describe('publicar sem código', () => {
  it('o admin do escritório dono publica, já aprovada', async () => {
    await assertSucceeds(setDoc(published('admin'), record()));
  });

  it('e não pode publicá-la como pendente — o estado da fila não é dele', async () => {
    await assertFails(setDoc(published('admin'), record({ status: 'pending' })));
  });

  it('quem não tem extensions.manage no escritório dono não publica', async () => {
    await assertFails(setDoc(published('membro'), record()));
  });

  it('nem quem administra OUTRO escritório em nome deste', async () => {
    await assertFails(setDoc(published('deFora'), record()));
  });
});

describe('publicar COM código', () => {
  it('o admin do escritório dono não publica, em status nenhum', async () => {
    await assertFails(setDoc(published('admin'), record({ package: withCode, hasCode: true })));
    await assertFails(setDoc(published('admin'), record({ package: withCode, hasCode: true, status: 'pending' })));
  });

  it('o SYSTEM publica', async () => {
    await assertSucceeds(setDoc(published('sistema'), record({ package: withCode, hasCode: true })));
  });

  it('o dono não acrescenta código a um registro que já é seu', async () => {
    await seed(env, { root: { [`public_extensions/${DOMAIN}`]: record() } });
    await assertFails(setDoc(published('admin'), record({ package: withCode, hasCode: true })));
  });
});

describe('republicar e moderar', () => {
  beforeEach(async () => {
    await seed(env, { root: { [`public_extensions/${DOMAIN}`]: record() } });
  });

  it('o dono republica a própria extensão', async () => {
    await assertSucceeds(setDoc(published('admin'), record({ version: '1.1.0' })));
  });

  it('o dono não entrega o domínio a outro escritório', async () => {
    await assertFails(setDoc(published('admin'), record({ ownerTenantId: OTHER_TENANT })));
  });

  it('quem administra outro escritório não republica por cima do domínio alheio', async () => {
    await assertFails(setDoc(published('deFora'), record({ ownerTenantId: OTHER_TENANT })));
  });

  it('obsoletar é do SYSTEM, não do dono', async () => {
    await assertFails(setDoc(published('admin'), record({ status: 'deprecated' })));
    await assertSucceeds(setDoc(published('sistema'), record({ status: 'deprecated' })));
  });

  it('retirar do catálogo é do SYSTEM, não do dono', async () => {
    await assertFails(deleteDoc(published('admin')));
    await assertSucceeds(deleteDoc(published('sistema')));
  });
});
