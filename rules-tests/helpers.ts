import { readFileSync } from 'node:fs';
import {
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, setDoc } from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';

export const TENANT = 't1';
export const OTHER_TENANT = 't2';

/**
 * O ambiente das regras, montado uma vez por arquivo.
 *
 * `firestore.rules` é lido do disco — é o MESMO arquivo que vai para produção. Um teste que
 * carregasse uma cópia provaria coisa nenhuma.
 */
export const testEnv = (): Promise<RulesTestEnvironment> =>
  initializeTestEnvironment({
    projectId: 'demo-microteia',
    firestore: {
      rules: readFileSync('firestore.rules', 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
  });

export interface Seed {
  /** `users/{uid}.role`. Ausente = `USER`. */
  users?: Record<string, { role?: string }>;
  /** O dono de cada escritório. */
  owners?: Record<string, string>;
  /** `tenants/{t}/members/{uid}.permissions` — o conjunto já materializado. */
  members?: Record<string, Record<string, string[]>>;
  /** Telas declaradas, por escritório: coleção -> o documento da tela. */
  screens?: Record<string, Record<string, Record<string, unknown>>>;
  /** Listas de opções declaradas, por escritório. */
  lookups?: Record<string, string[]>;
  /** Perfis de acesso, por escritório. */
  roles?: Record<string, Record<string, Record<string, unknown>>>;
  /** Registros já existentes: `tenants/{t}/{coleção}/{id}`. */
  records?: Record<string, Record<string, Record<string, unknown>>>;
  /** Documentos de coleção-RAIZ (fora de tenant): `{coleção}/{id}`. */
  root?: Record<string, Record<string, unknown>>;
}

/**
 * Semeia o banco IGNORANDO as regras. O que se testa é o acesso do cliente, não a semeadura — e
 * escrever a semente pelas regras exigiria uma regra que as afrouxasse.
 */
export const seed = async (env: RulesTestEnvironment, data: Seed): Promise<void> => {
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore() as unknown as Firestore;

    for (const [uid, user] of Object.entries(data.users ?? {})) {
      await setDoc(doc(db, 'users', uid), { role: user.role ?? 'USER' });
    }
    for (const [tenantId, ownerId] of Object.entries(data.owners ?? {})) {
      await setDoc(doc(db, 'tenants', tenantId), { name: tenantId, ownerId });
    }
    for (const [tenantId, members] of Object.entries(data.members ?? {})) {
      for (const [uid, permissions] of Object.entries(members)) {
        await setDoc(doc(db, 'tenants', tenantId, 'members', uid), { userId: uid, tenantId, permissions });
      }
    }
    for (const [tenantId, screens] of Object.entries(data.screens ?? {})) {
      for (const [key, screen] of Object.entries(screens)) {
        await setDoc(doc(db, 'tenants', tenantId, 'screenDefinitions', key), screen);
      }
    }
    for (const [tenantId, collections] of Object.entries(data.lookups ?? {})) {
      for (const collection of collections) {
        await setDoc(doc(db, 'tenants', tenantId, 'lookupDefinitions', collection), { label: collection });
      }
    }
    for (const [tenantId, roles] of Object.entries(data.roles ?? {})) {
      for (const [roleId, role] of Object.entries(roles)) {
        await setDoc(doc(db, 'tenants', tenantId, 'roles', roleId), role);
      }
    }
    for (const [tenantId, collections] of Object.entries(data.records ?? {})) {
      for (const [path, record] of Object.entries(collections)) {
        const [collection, id] = path.split('/');
        await setDoc(doc(db, 'tenants', tenantId, collection, id), record);
      }
    }
    for (const [path, record] of Object.entries(data.root ?? {})) {
      const [collection, id] = path.split('/');
      await setDoc(doc(db, collection, id), record);
    }
  });
};

export const asUser = (env: RulesTestEnvironment, uid: string): Firestore =>
  env.authenticatedContext(uid).firestore() as unknown as Firestore;

export const asAnonymous = (env: RulesTestEnvironment): Firestore =>
  env.unauthenticatedContext().firestore() as unknown as Firestore;
