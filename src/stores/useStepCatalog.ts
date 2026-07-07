import { createContext, useContext } from 'react';
import type { StepDefinitionSummary } from '../domain/entities/WorkflowStepCatalog';

export interface StepCatalogContextValue {
  stepCatalog: StepDefinitionSummary[];
  loading: boolean;
  loadCatalog: () => Promise<void>;
}

export const StepCatalogContext = createContext<StepCatalogContextValue | null>(null);

/**
 * Hook para acessar o catálogo de Steps.
 * O catálogo é carregado uma única vez via Cloud Function e mantido em memória.
 * Chame `loadCatalog()` quando precisar garantir que o catálogo está carregado
 * (idempotente — não faz nada se já foi carregado).
 */
export const useStepCatalog = (): StepCatalogContextValue => {
  const context = useContext(StepCatalogContext);
  if (!context) {
    throw new Error('useStepCatalog deve ser usado dentro de StepCatalogProvider');
  }
  return context;
};

