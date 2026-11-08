import { describe, it, expect } from 'vitest';
import type { Firestore } from 'firebase-admin/firestore';
import { FirebaseUserRepository } from './FirebaseUserRepository';

type Store = Map<string, Record<string, unknown>>;

const makeFakeDb = (store: Store): Firestore => {
  const docRef = (path: string) => ({ kind: 'doc' as const, path });
  const queryRef = (collection: string) => ({ kind: 'query' as const, collection });
  type Ref = ReturnType<typeof docRef> | ReturnType<typeof queryRef>;

  const tx = {
    get: async (ref: Ref) => {
      if (ref.kind === 'doc') {
        const data = store.get(ref.path);
        return { exists: data !== undefined, data: () => data };
      }
      const prefix = `${ref.collection}/`;
      const found = [...store.keys()].filter((key) => key.startsWith(prefix) && !key.slice(prefix.length).includes('/'));
      return { empty: found.length === 0 };
    },
    set: (ref: ReturnType<typeof docRef>, data: Record<string, unknown>) => {
      store.set(ref.path, data);
    },
  };

  return {
    collection: (name: string) => ({
      doc: (id: string) => docRef(`${name}/${id}`),
      limit: () => queryRef(name),
    }),
    doc: (path: string) => docRef(path),
    runTransaction: async <T>(fn: (t: typeof tx) => Promise<T>) => fn(tx),
  } as unknown as Firestore;
};

const input = { email: 'novo@exemplo.com', displayName: 'Novo', photoURL: null };

describe('FirebaseUserRepository.createUserIfMissing', () => {
  it('o primeiro usuário de uma instalação vazia nasce SYSTEM e reivindica a marca', async () => {
    const store: Store = new Map();
    await new FirebaseUserRepository(makeFakeDb(store)).createUserIfMissing('u1', input);

    expect(store.get('users/u1')?.role).toBe('SYSTEM');
    expect(store.get('system/bootstrap')?.claimedBy).toBe('u1');
  });

  it('o primeiro usuário fecha a instalação para contas novas, na mesma transação', async () => {
    const store: Store = new Map();
    await new FirebaseUserRepository(makeFakeDb(store)).createUserIfMissing('u1', input);

    expect(store.get('system/registration')).toMatchObject({ acceptNewAccounts: false, updatedBy: 'u1' });
  });

  it('banco anterior à marca não ganha a trava fechada: quem já se cadastrava continua podendo', async () => {
    const store: Store = new Map([['users/antigo', { role: 'SYSTEM' }]]);
    await new FirebaseUserRepository(makeFakeDb(store)).createUserIfMissing('u2', input);

    expect(store.has('system/registration')).toBe(false);
  });

  it('o segundo usuário nasce USER', async () => {
    const store: Store = new Map();
    const repo = new FirebaseUserRepository(makeFakeDb(store));
    await repo.createUserIfMissing('u1', input);
    await repo.createUserIfMissing('u2', input);

    expect(store.get('users/u2')?.role).toBe('USER');
  });

  it('banco anterior à marca, com usuários já cadastrados, não promove o novo usuário a SYSTEM', async () => {
    const store: Store = new Map([['users/antigo', { role: 'SYSTEM' }]]);
    await new FirebaseUserRepository(makeFakeDb(store)).createUserIfMissing('u2', input);

    expect(store.get('users/u2')?.role).toBe('USER');
    expect(store.get('system/bootstrap')?.claimedBy).toBeNull();
  });

  it('banco anterior à marca, só com escritórios, também não promove o novo usuário a SYSTEM', async () => {
    const store: Store = new Map([['tenants/t1', { ownerId: 'antigo' }]]);
    await new FirebaseUserRepository(makeFakeDb(store)).createUserIfMissing('u2', input);

    expect(store.get('users/u2')?.role).toBe('USER');
  });
});
