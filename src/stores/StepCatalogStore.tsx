import React, { useState, useEffect, type ReactNode } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../infrastructure/firebase/config';
import type { StepDefinitionSummary } from '../domain/entities/WorkflowStepCatalog';
import { StepCatalogContext } from './useStepCatalog';

interface StepCatalogProviderProps {
  children: ReactNode;
}

/**
 * Provider do catálogo de Steps.
 * Carrega via cloud function sempre que monta, sem cache permanente.
 * Se precisar forçar reload após deploy, basta dar F5 na página.
 */
export const StepCatalogProvider: React.FC<StepCatalogProviderProps> = ({ children }) => {
  const [stepCatalog, setStepCatalog] = useState<StepDefinitionSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const loadCatalog = async () => {
    try {
      setLoading(true);
      const getWorkflowStepCatalog = httpsCallable<void, { steps: StepDefinitionSummary[] }>(functions, 'getWorkflowStepCatalog');
      const result = await getWorkflowStepCatalog();
      setStepCatalog(result.data.steps);
    } catch (error) {
      console.error('[StepCatalogStore] Erro ao carregar catálogo:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadCatalog();
  }, []);

  return (
    <StepCatalogContext.Provider value={{ stepCatalog, loading, loadCatalog }}>
      {children}
    </StepCatalogContext.Provider>
  );
};
