import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { assertFails, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { deleteDoc, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { TENANT, asUser, seed, testEnv } from './helpers';

/**
 * A caixa de e-mail não é lida nem gravada pelo cliente — nem pelo dono da caixa, nem pelo do escritório,
 * nem por quem administra as caixas. O documento guarda o ponto de leitura e o prazo da próxima, e a senha
 * mora em `secrets/`: a porta é a callable `manageMailbox`.
 */
let env: RulesTestEnvironment;

beforeAll(async () => { env = await testEnv(); });
afterAll(async () => { await env.cleanup(); });

beforeEach(async () => {
  await env.clearFirestore();
  await seed(env, {
    users: { membro: {}, gestor: {} },
    owners: { [TENANT]: 'dono' },
    members: { [TENANT]: { membro: ['mailboxes.connect'], gestor: ['mailboxes.manage', 'mailboxes.connect'] } },
    records: {
      [TENANT]: {
        'mailboxes/box': { ownerId: 'membro', name: 'Minha', nextPollAt: null },
        'mailboxes/box/secrets/current': { password: 'segredo' },
        'mail_messages/m1': { mailboxId: 'box', subject: 'Intimação' },
      },
    },
  });
});

describe('mailboxes', () => {
  it('nem o dono da caixa, nem quem administra, nem o dono do escritório leem a caixa ou a senha', async () => {
    for (const uid of ['membro', 'gestor', 'dono']) {
      const db = asUser(env, uid);
      await assertFails(getDoc(doc(db, `tenants/${TENANT}/mailboxes/box`)));
      await assertFails(getDoc(doc(db, `tenants/${TENANT}/mailboxes/box/secrets/current`)));
    }
  });

  it('ninguém grava o ponto de leitura nem o prazo pelo cliente', async () => {
    const db = asUser(env, 'membro');
    await assertFails(updateDoc(doc(db, `tenants/${TENANT}/mailboxes/box`), { nextPollAt: null, cursor: null }));
    await assertFails(setDoc(doc(db, `tenants/${TENANT}/mailboxes/nova`), { ownerId: 'membro' }));
    await assertFails(deleteDoc(doc(asUser(env, 'gestor'), `tenants/${TENANT}/mailboxes/box`)));
  });
});

describe('mail_messages', () => {
  it('a mensagem entregue é só do servidor', async () => {
    for (const uid of ['membro', 'gestor', 'dono']) {
      const db = asUser(env, uid);
      await assertFails(getDoc(doc(db, `tenants/${TENANT}/mail_messages/m1`)));
      await assertFails(setDoc(doc(db, `tenants/${TENANT}/mail_messages/m2`), { subject: 'forjada' }));
    }
  });
});

describe('mail_inbound_addresses', () => {
  it('o índice de endereço de encaminhamento → caixa é só do servidor', async () => {
    for (const uid of ['membro', 'gestor', 'dono']) {
      const db = asUser(env, uid);
      await assertFails(getDoc(doc(db, 'mail_inbound_addresses/abcdefghijklmnopqrstuvwx')));
      await assertFails(setDoc(doc(db, 'mail_inbound_addresses/abcdefghijklmnopqrstuvwx'), { tenantId: TENANT, mailboxId: 'box' }));
    }
  });
});
