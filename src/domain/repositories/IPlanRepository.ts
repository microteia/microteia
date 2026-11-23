import type { PlanDefinition } from '../schema/plans';

/** O que se grava de um plano. O id é escolhido na criação e nunca muda: é ele que o escritório guarda. */
export type PlanInput = Omit<PlanDefinition, 'id'>;

/** Os planos da instalação (`plans/{id}`, #24). Só o `SYSTEM` lista e grava; o membro lê o do escritório. */
export interface IPlanRepository {
  listPlans(): Promise<PlanDefinition[]>;
  getPlan(planId: string): Promise<PlanDefinition | null>;
  /** O plano ao vivo — `null` quando ele não existe. Devolve a função que cancela a assinatura. */
  subscribePlan(planId: string, onChange: (plan: PlanDefinition | null) => void, onError: (error: Error) => void): () => void;
  createPlan(input: PlanInput, updatedBy: string): Promise<PlanDefinition>;
  /** Grava o plano com este id só se ele ainda não existir — a migração não pode sobrepor uma edição. */
  createPlanIfMissing(planId: string, input: PlanInput, updatedBy: string): Promise<boolean>;
  updatePlan(planId: string, change: Partial<PlanInput>, updatedBy: string): Promise<void>;
  deletePlan(planId: string): Promise<void>;
  /** Algum escritório está neste plano? Um plano em uso não se exclui — arquiva-se. */
  isPlanInUse(planId: string): Promise<boolean>;
}
