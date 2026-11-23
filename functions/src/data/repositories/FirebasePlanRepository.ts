import type { Firestore } from 'firebase-admin/firestore';
import type { IPlanRepository, NewTenantPlan } from '../../domain/repositories/IPlanRepository';
import { NO_PLAN_MEMBER_LIMIT, PLANS_COLLECTION, planDefinitionOf, type PlanDefinition } from '../../domain/schema/plans';
import { REGISTRATION_POLICY_PATH, registrationPolicyOf } from '../../domain/schema/registration';

const NO_PLAN: NewTenantPlan = { plan: null, memberLimit: NO_PLAN_MEMBER_LIMIT };

export class FirebasePlanRepository implements IPlanRepository {
  constructor(private readonly db: Firestore) {}

  async getPlan(planId: string): Promise<PlanDefinition | null> {
    const snap = await this.db.collection(PLANS_COLLECTION).doc(planId).get();
    return snap.exists ? planDefinitionOf(snap.id, snap.data()) : null;
  }

  async newTenantPlan(): Promise<NewTenantPlan> {
    const registration = await this.db.doc(REGISTRATION_POLICY_PATH).get();
    const { defaultPlanId } = registrationPolicyOf(registration.exists ? registration.data() : undefined);
    if (!defaultPlanId) return NO_PLAN;
    const plan = await this.getPlan(defaultPlanId);
    if (!plan || plan.archived) return NO_PLAN;
    return { plan: plan.id, memberLimit: plan.memberLimit };
  }

  async tenantIdsOnPlan(planId: string): Promise<string[]> {
    const snap = await this.db.collection('tenants').where('plan', '==', planId).select().get();
    return snap.docs.map((doc) => doc.id);
  }
}
