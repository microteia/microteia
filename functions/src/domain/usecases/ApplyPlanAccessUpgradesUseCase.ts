import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import { ACCESS_UPGRADE_AUTHOR } from '../schema/access';
import {
  PLANS_COLLECTION,
  pendingPlanAccessUpgrades,
  planDefinitionOf,
  upgradePlanDenied,
} from '../schema/plans';

export type ApplyPlanAccessUpgradesUseCase = {
  /** `true` quando o plano recebeu alguma conversão nesta chamada. */
  execute: (planId: string) => Promise<boolean>;
};

/**
 * Aplica ao plano as conversões que ele ainda não recebeu (ver `PLAN_ACCESS_UPGRADES`).
 *
 * **Transação**, pela razão de `ApplyAccessUpgradesUseCase`: os escritórios do plano abrem o app ao mesmo
 * tempo logo depois do upgrade, e a marca e as negações gravam juntas. O segundo relê a marca e não faz
 * nada — sem isso, ele poderia negar de novo o que o `SYSTEM` acabou de liberar.
 *
 * A marca é gravada mesmo quando nada muda nas negações: é ela que faz o navegador parar de pedir a
 * conversão. Mudando as negações, o gatilho do plano recompõe todos os escritórios dele.
 */
export const makeApplyPlanAccessUpgradesUseCase = (db: Firestore): ApplyPlanAccessUpgradesUseCase => ({
  execute: async (planId) => {
    const planRef = db.collection(PLANS_COLLECTION).doc(planId);
    return db.runTransaction(async (tx) => {
      const snap = await tx.get(planRef);
      if (!snap.exists) return false;
      const plan = planDefinitionOf(snap.id, snap.data());
      const pending = pendingPlanAccessUpgrades(plan.accessUpgrades);
      if (pending.length === 0) return false;
      const denied = upgradePlanDenied(pending, plan.deniedPermissions);
      tx.update(planRef, {
        accessUpgrades: FieldValue.arrayUnion(...pending),
        ...(denied ? { deniedPermissions: denied } : {}),
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: ACCESS_UPGRADE_AUTHOR,
      });
      return true;
    });
  },
});
