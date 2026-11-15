import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { deleteDoc, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { OTHER_TENANT, TENANT, asAnonymous, asUser, seed, testEnv } from './helpers';

/**
 * `public_extensions/{domain}` — o catálogo que todo escritório vê.
 *
 * Publicar não é escrita do cliente: é a callable `publishExtension`, que lê a cópia INSTALADA no
 * escritório dono e só a publica completa, gravando a prova (`proof`). Se o cliente pudesse escrever
 * aqui — inclusive o SYSTEM —, a prova seria uma afirmação de quem escreve, e o catálogo deixaria de
 * garantir que o que oferece instala. Pelo navegador sobra só a moderação do SYSTEM: o `status`.
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

// Sem view nenhuma: só a fonte de Cloud Function que o build embute. É código de SERVIDOR.
const withServerCode = pkg({
  manifest: { id: DOMAIN, version: '1.0.0', kernel: '^2.0.0', name: 'CRM', backend: { functions: ['crmSync'] } },
  backendSource: { files: { 'index.ts': 'export {};' }, hash: 'a'.repeat(64) },
});

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

describe('publicar pelo navegador', () => {
  it('o admin do escritório dono não publica direto — a porta é a callable', async () => {
    await assertFails(setDoc(published('admin'), record()));
  });

  it('nem o SYSTEM, com ou sem código', async () => {
    await assertFails(setDoc(published('sistema'), record()));
    await assertFails(setDoc(published('sistema'), record({ package: withCode, hasCode: true })));
    await assertFails(setDoc(published('sistema'), record({ package: withServerCode, hasCode: true })));
  });
});

describe('republicar e moderar', () => {
  beforeEach(async () => {
    await seed(env, { root: { [`public_extensions/${DOMAIN}`]: record() } });
  });

  it('o dono não republica por cima do próprio registro', async () => {
    await assertFails(setDoc(published('admin'), record({ version: '1.1.0' })));
  });

  it('o SYSTEM obsoleta e reaprova, mexendo só no status', async () => {
    await assertSucceeds(updateDoc(published('sistema'), { status: 'deprecated' }));
    await assertSucceeds(updateDoc(published('sistema'), { status: 'approved' }));
  });

  it('o dono não obsoleta', async () => {
    await assertFails(updateDoc(published('admin'), { status: 'deprecated' }));
  });

  it('o SYSTEM não devolve à fila legada nem inventa status', async () => {
    await assertFails(updateDoc(published('sistema'), { status: 'pending' }));
    await assertFails(updateDoc(published('sistema'), { status: 'whatever' }));
  });

  // A prova é o que o catálogo garante: escrita pela tela, ela seria só a palavra de quem escreveu.
  it('nem o SYSTEM troca o pacote ou escreve a prova pela tela', async () => {
    await assertFails(updateDoc(published('sistema'), { package: withCode }));
    await assertFails(updateDoc(published('sistema'), {
      proof: { tenantId: TENANT, version: '1.0.0', revision: 'x', provenBy: 'sistema', provenAt: new Date() },
    }));
    await assertFails(updateDoc(published('sistema'), { status: 'approved', ownerTenantId: OTHER_TENANT }));
  });

  it('retirar do catálogo é do SYSTEM, não do dono', async () => {
    await assertFails(deleteDoc(published('admin')));
    await assertSucceeds(deleteDoc(published('sistema')));
  });
});
