import { describe, it, expect } from 'vitest';
import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import { ACCESS_UPGRADE_AUTHOR } from '../schema/access';
import { PLAN_ACCESS_UPGRADES } from '../schema/plans';
import { makeApplyPlanAccessUpgradesUseCase } from './ApplyPlanAccessUpgradesUseCase';

type Doc = Record<string, unknown>;

/** O suficiente do Admin SDK para a transação sobre `plans/{id}`; a marca chega como `arrayUnion`. */
const fakeDb = (plans: Record<string, Doc>) => {
  const writes: { id: string; patch: Doc }[] = [];
  const db = {
    collection: () => ({ doc: (id: string) => ({ id }) }),
    runTransaction: async <T>(fn: (tx: unknown) => Promise<T>): Promise<T> => fn({
      get: async (ref: { id: string }) => ({ id: ref.id, exists: plans[ref.id] !== undefined, data: () => plans[ref.id] }),
      update: (ref: { id: string }, patch: Doc) => {
        writes.push({ id: ref.id, patch });
        const union = patch.accessUpgrades as FieldValue;
        plans[ref.id] = {
          ...plans[ref.id],
          ...patch,
          accessUpgrades: union.isEqual(FieldValue.arrayUnion(...PLAN_ACCESS_UPGRADES)) ? [...PLAN_ACCESS_UPGRADES] : patch.accessUpgrades,
        };
      },
    }),
  } as unknown as Firestore;
  return { db, writes };
};

describe('ApplyPlanAccessUpgradesUseCase (#41)', () => {
  it('converte o plano antigo: nega as ações contidas e grava a marca, assinada pela versão', async () => {
    const plans: Record<string, Doc> = { starter: { name: 'Starter', deniedPermissions: ['pets.create', 'pets.update'] } };
    const { db, writes } = fakeDb(plans);

    expect(await makeApplyPlanAccessUpgradesUseCase(db).execute('starter')).toBe(true);

    expect(plans.starter.deniedPermissions).toEqual(['pets.annotate', 'pets.attach', 'pets.create', 'pets.tag', 'pets.update']);
    expect(plans.starter.accessUpgrades).toEqual([...PLAN_ACCESS_UPGRADES]);
    expect(writes[0].patch.updatedBy).toBe(ACCESS_UPGRADE_AUTHOR);
  });

  it('sem nada a negar, grava só a marca — as negações nem entram na gravação', async () => {
    const plans: Record<string, Doc> = { pro: { name: 'Pro', deniedPermissions: ['pets.create'] } };
    const { db, writes } = fakeDb(plans);

    await makeApplyPlanAccessUpgradesUseCase(db).execute('pro');

    expect(writes).toHaveLength(1);
    expect(writes[0].patch).not.toHaveProperty('deniedPermissions');
    expect(plans.pro.accessUpgrades).toEqual([...PLAN_ACCESS_UPGRADES]);
  });

  it('plano já convertido não é tocado — a liberação que o SYSTEM fez depois fica', async () => {
    const plans: Record<string, Doc> = {
      starter: { name: 'Starter', deniedPermissions: ['pets.update'], accessUpgrades: [...PLAN_ACCESS_UPGRADES] },
    };
    const { db, writes } = fakeDb(plans);

    expect(await makeApplyPlanAccessUpgradesUseCase(db).execute('starter')).toBe(false);
    expect(writes).toEqual([]);
  });

  it('plano que não existe não grava nada', async () => {
    const { db, writes } = fakeDb({});
    expect(await makeApplyPlanAccessUpgradesUseCase(db).execute('ghost')).toBe(false);
    expect(writes).toEqual([]);
  });
});
