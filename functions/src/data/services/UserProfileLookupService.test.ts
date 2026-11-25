import { describe, expect, it } from 'vitest';
import type { Firestore } from 'firebase-admin/firestore';
import { UserProfileLookupService } from './UserProfileLookupService';
import { SYSTEM_ACTOR_NAME } from '../../domain/repositories/IUserProfileLookupService';

/** Só o que `resolveIdentity` lê: `userProfiles/{uid}` e `users/{uid}`. */
const fakeDb = (docs: Record<string, Record<string, unknown>>): Firestore => ({
  collection: (name: string) => ({
    doc: (id: string) => ({
      get: async () => ({ exists: docs[`${name}/${id}`] !== undefined, data: () => docs[`${name}/${id}`] }),
    }),
  }),
}) as unknown as Firestore;

describe('o autor que a Auditoria grava (#30)', () => {
  it('sem pessoa, é a REFERÊNCIA do sistema — nunca a palavra num idioma', async () => {
    const actor = await new UserProfileLookupService(fakeDb({})).resolveActor('');
    expect(actor).toEqual({ name: SYSTEM_ACTOR_NAME, photoURL: '' });
  });

  it('a pessoa que já não tem perfil é o "usuário desconhecido", também por referência', async () => {
    const actor = await new UserProfileLookupService(fakeDb({})).resolveActor('u-sumiu');
    expect(actor.name).toBe('@core.workspace/user.unknown');
  });

  it('a pessoa é o nome efetivo dela', async () => {
    const actor = await new UserProfileLookupService(fakeDb({ 'users/u1': { displayName: 'Ana Lima' } })).resolveActor('u1');
    expect(actor.name).toBe('Ana Lima');
  });
});
