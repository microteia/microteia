import { createContext, useContext } from 'react';
import type { PlanDefinition } from '../domain/schema/plans';

export interface PlanContextValue {
  /** O plano do escritório corrente. `null` sem escritório, sem plano, ou com plano que não existe. */
  currentPlan: PlanDefinition | null;
  /** O plano do escritório corrente ainda não chegou — o teto dele não é conhecido. */
  isLoading: boolean;
}

export const PlanContext = createContext<PlanContextValue | null>(null);

export const usePlan = (): PlanContextValue => {
  const ctx = useContext(PlanContext);
  if (!ctx) throw new Error('usePlan must be used within PlanStoreProvider');
  return ctx;
};
