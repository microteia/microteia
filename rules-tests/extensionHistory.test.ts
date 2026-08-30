import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { deleteDoc, doc, getDoc, setDoc } from 'firebase/firestore';
import { asAnonymous, asUser, seed, TENANT, testEnv } from './helpers';

/**
 * `tenants/{t}/extension_history/{pluginId}` e a subcoleção `versions/{revision}`.
 *
 * A subcoleção é a razão deste arquivo. O `match` do curinga de registros não a alcança (ele é
 * `/{coleção}/{doc}`, sem `=**`), então uma subcoleção SEM regra própria fica sem regra nenhuma — e o
 * sintoma não é um erro que se leia: é o pacote da versão nunca sendo gravado, com o índice gravado,
 * e o histórico oferecendo uma volta que falha só quando alguém a tenta.
 *
 * O `delete` PERMITIDO é a outra diferença que precisa de rede: `extension_migrations`, ao lado, o
 * nega de propósito. Aqui ele existe porque EXCLUIR a extensão apaga o histórico dela — e é ele que
 * separa excluir de desinstalar.
 */
let env: RulesTestEnvironment;

beforeAll(async () => { env = await testEnv(); });
afterAll(async () => { await env.cleanup(); });

const PLUGIN = 'com.acme.crm';
const INDEX = `tenants/${TENANT}/extension_history/${PLUGIN}`;
const VERSION = `${INDEX}/versions/abc123`;

beforeEach(async () => {
  await env.clearFirestore();
  await seed(env, {
    users: { admin: {}, membro: {} },
    members: {
      [TENANT]: {
        admin: ['extensions.manage'],
        membro: [],
      },
    },
  });
});

describe('o histórico de versões aplicadas de uma extensão', () => {
  it('quem gerencia extensões grava o índice e o pacote da versão', async () => {
    const db = asUser(env, 'admin');
    await assertSucceeds(setDoc(doc(db, INDEX), { pluginId: PLUGIN, entries: [] }));
    await assertSucceeds(setDoc(doc(db, VERSION), { revision: 'abc123', package: { manifest: {} } }));
  });

  /**
   * Todo membro LÊ, como em `installed_extensions`: o pacote guardado aqui é o mesmo que já está
   * exposto lá, então a leitura não abre nada de novo — e negá-la só produziria a tela meio carregada
   * de quem pode ver a extensão instalada mas não o que já se aplicou dela.
   */
  it('qualquer membro lê', async () => {
    const db = asUser(env, 'membro');
    await assertSucceeds(getDoc(doc(db, INDEX)));
    await assertSucceeds(getDoc(doc(db, VERSION)));
  });

  it('membro sem a permissão não grava — gravar aqui é o mesmo ato de instalar', async () => {
    const db = asUser(env, 'membro');
    await assertFails(setDoc(doc(db, INDEX), { pluginId: PLUGIN, entries: [] }));
    await assertFails(setDoc(doc(db, VERSION), { revision: 'abc123', package: {} }));
  });

  it('quem não é do escritório não alcança nem a leitura', async () => {
    await assertFails(getDoc(doc(asAnonymous(env), INDEX)));
  });

  /**
   * O oposto de `extension_migrations`, que nega `delete`. Aqui a exclusão da extensão apaga o
   * histórico inteiro — índice e pacotes —, e sem esta permissão o gesto de EXCLUIR deixaria para
   * trás megabytes de pacotes de uma extensão que já não existe.
   */
  it('quem gerencia extensões apaga o histórico — é a cascata do EXCLUIR', async () => {
    const db = asUser(env, 'admin');
    await assertSucceeds(deleteDoc(doc(db, VERSION)));
    await assertSucceeds(deleteDoc(doc(db, INDEX)));
  });

  it('membro sem a permissão não apaga', async () => {
    const db = asUser(env, 'membro');
    await assertFails(deleteDoc(doc(db, INDEX)));
    await assertFails(deleteDoc(doc(db, VERSION)));
  });
});
