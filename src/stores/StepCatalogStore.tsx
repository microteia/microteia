import React, { useState, useCallback, type ReactNode } from 'react';
import type { StepDefinitionSummary } from '../domain/entities/WorkflowStepCatalog';
import { StepCatalogContext } from './useStepCatalog';
import { useNotification } from './useNotification';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../infrastructure/firebase/config';

interface StepCatalogProviderProps {
  children: ReactNode;
}

/**
 * Provider do catálogo de Steps.
 * Carrega o catálogo uma única vez via Cloud Function e mantém em memória.
 * Se já estiver carregado, não faz nova chamada.
 */
export const StepCatalogProvider: React.FC<StepCatalogProviderProps> = ({ children }) => {
  const [stepCatalog, setStepCatalog] = useState<StepDefinitionSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const { notify } = useNotification();

  const loadCatalog = useCallback(async () => {
    // Se já carregou ou está carregando, não faz nada
    if (loaded || loading) return;

    setLoading(true);
    try {
      const getWorkflowStepCatalog = httpsCallable<void, { steps: StepDefinitionSummary[] }>(
        functions,
        'getWorkflowStepCatalog'
      );

      const result = await getWorkflowStepCatalog();
      setStepCatalog(result.data.steps);
      setLoaded(true);
    } catch (error) {
      console.error('Erro ao carregar catálogo de Steps:', error);
      notify('Erro ao carregar o catálogo de automações.', 'error');
    } finally {
      setLoading(false);
    }
  }, [loaded, loading, notify]);

  return (
    <StepCatalogContext.Provider value={{ stepCatalog, loading, loadCatalog }}>
      {children}
    </StepCatalogContext.Provider>
  );
};
