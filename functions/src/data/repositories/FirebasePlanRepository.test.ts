import { describe, expect, it } from 'vitest';
import type { Firestore } from 'firebase-admin/firestore';
import { FirebasePlanRepository } from './FirebasePlanRepository';

type Docs = Record<string, Record<string, unknown> | undefined>;

const fakeDb = (docs: Docs): Firestore => ({
  doc: (path: string) => ({ get: async () => ({ exists: docs[path] !== undefined, data: () => docs[path] }) }),
  collection: (name: string) => ({
    doc: (id: string) => ({
      get: async () => ({ id, exists: docs[`${name}/${id}`] !== undefined, data: () => docs[`${name}/${id}`] }),
    }),
  }),
}) as unknown as Firestore;

describe('FirebasePlanRepository.newTenantPlan', () => {
  it('sem plano padrão, o escritório nasce sem plano e com o limite de antes', async () => {
    const repo = new FirebasePlanRepository(fakeDb({}));
    await expect(repo.newTenantPlan()).resolves.toEqual({ plan: null, memberLimit: 1 });
  });

  it('com plano padrão, o escritório nasce nele e com o limite dele — inclusive sem limite', async () => {
    const repo = new FirebasePlanRepository(fakeDb({
      'system/registration': { defaultPlanId: 'starter' },
      'plans/starter': { name: 'Starter', memberLimit: null },
    }));
    await expect(repo.newTenantPlan()).resolves.toEqual({ plan: 'starter', memberLimit: null });
  });

  it('padrão arquivado, ou que não existe mais, cai no escritório sem plano', async () => {
    const archived = new FirebasePlanRepository(fakeDb({
      'system/registration': { defaultPlanId: 'old' },
      'plans/old': { name: 'Old', memberLimit: 10, archived: true },
    }));
    await expect(archived.newTenantPlan()).resolves.toEqual({ plan: null, memberLimit: 1 });
    const gone = new FirebasePlanRepository(fakeDb({ 'system/registration': { defaultPlanId: 'gone' } }));
    await expect(gone.newTenantPlan()).resolves.toEqual({ plan: null, memberLimit: 1 });
  });
});
