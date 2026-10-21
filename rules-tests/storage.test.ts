import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { deleteObject, getMetadata, ref, uploadString, type FirebaseStorage } from 'firebase/storage';
import { TENANT, seed, testEnv } from './helpers';

/**
 * O Storage segue a PERMISSÃO da coleção, como o registro. O link de download (com `token=`) não
 * passa por regra nenhuma, e por isso não aparece aqui: é ele que continua abrindo para quem o tem.
 */
let env: RulesTestEnvironment;

beforeAll(async () => { env = await testEnv(); });
afterAll(async () => { await env.cleanup(); });

const FILE = `tenants/${TENANT}/invoices/nf1/1700000000_nota.pdf`;
const storageOf = (uid: string) => env.authenticatedContext(uid).storage() as unknown as FirebaseStorage;

beforeEach(async () => {
  await env.clearFirestore();
  await env.clearStorage();
  await seed(env, {
    users: { dono: {}, leitor: {}, editor: {}, outro: {}, gerente: {} },
    owners: { [TENANT]: 'dono' },
    members: {
      [TENANT]: {
        leitor: ['invoices.read'],
        editor: ['invoices.read', 'invoices.update'],
        outro: ['clients.read'],
        gerente: ['tenant.update'],
      },
    },
  });
  await env.withSecurityRulesDisabled(async (context) => {
    await uploadString(ref(context.storage() as unknown as FirebaseStorage, FILE), 'pdf');
  });
});

describe('arquivos de registro', () => {
  it('lê pelo SDK quem lê a coleção — o membro de outra tela, não', async () => {
    await assertSucceeds(getMetadata(ref(storageOf('leitor'), FILE)));
    await assertSucceeds(getMetadata(ref(storageOf('dono'), FILE)));
    await assertFails(getMetadata(ref(storageOf('outro'), FILE)));
  });

  it('envia quem altera a coleção; quem só lê, não', async () => {
    const novo = `tenants/${TENANT}/invoices/nf1/1700000001_recibo.pdf`;
    await assertSucceeds(uploadString(ref(storageOf('editor'), novo), 'x'));
    await assertFails(uploadString(ref(storageOf('leitor'), `tenants/${TENANT}/invoices/nf1/1700000002_x.pdf`), 'x'));
  });

  it('apaga quem altera a coleção — o campo antigo `role` não decide mais nada', async () => {
    await assertFails(deleteObject(ref(storageOf('leitor'), FILE)));
    await assertSucceeds(deleteObject(ref(storageOf('editor'), FILE)));
  });
});

describe('logo do escritório', () => {
  const logo = (name: string) => `tenants/${TENANT}/branding/logo/${name}`;

  it('envia quem altera o escritório, só imagem, e ninguém apaga', async () => {
    await assertSucceeds(uploadString(ref(storageOf('gerente'), logo('a.png')), 'png', 'raw', { contentType: 'image/png' }));
    await assertFails(uploadString(ref(storageOf('gerente'), logo('b.pdf')), 'pdf', 'raw', { contentType: 'application/pdf' }));
    await assertFails(uploadString(ref(storageOf('editor'), logo('c.png')), 'png', 'raw', { contentType: 'image/png' }));
    await assertFails(deleteObject(ref(storageOf('gerente'), logo('a.png'))));
  });

  it('a pasta do logo não cai no curinga dos registros', async () => {
    await assertFails(uploadString(ref(storageOf('editor'), `tenants/${TENANT}/branding/x/y.png`), 'png', 'raw', { contentType: 'image/png' }));
  });
});
