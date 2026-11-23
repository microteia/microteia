import type { PlanDefinition } from '../schema/plans';

/** O plano e o limite com que nasce um escritório novo. */
export interface NewTenantPlan {
  plan: string | null;
  memberLimit: number | null;
}

/** Os planos da instalação, vistos pelo servidor. Ver `domain/schema/plans.ts`. */
export interface IPlanRepository {
  getPlan(planId: string): Promise<PlanDefinition | null>;
  /**
   * O plano padrão de `system/registration`, com o limite dele. Sem padrão, ou com um padrão que não
   * existe mais ou foi arquivado, o escritório nasce sem plano e com o limite de antes.
   */
  newTenantPlan(): Promise<NewTenantPlan>;
  /** Os escritórios que hoje estão no plano — quem recompõe quando o teto dele muda. */
  tenantIdsOnPlan(planId: string): Promise<string[]>;
}
