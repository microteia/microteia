import React, { useState, useEffect, useCallback, type ReactNode } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../infrastructure/firebase/config';
import type { StepDefinitionSummary } from '../domain/entities/WorkflowStepCatalog';
import { StepCatalogContext } from './useStepCatalog';

interface StepCatalogProviderProps {
  children: ReactNode;
}

const fetchStepCatalog = async (): Promise<StepDefinitionSummary[]> => {
  const getWorkflowStepCatalog = httpsCallable<void, { steps: StepDefinitionSummary[] }>(functions, 'getWorkflowStepCatalog');
  const result = await getWorkflowStepCatalog();
  return result.data.steps;
};

export const StepCatalogProvider: React.FC<StepCatalogProviderProps> = ({ children }) => {
  const [stepCatalog, setStepCatalog] = useState<StepDefinitionSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const loadCatalog = useCallback(async () => {
    setLoading(true);
    try {
      setStepCatalog(await fetchStepCatalog());
    } catch (error) {
      console.error('[StepCatalogStore] Erro ao carregar catálogo:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const loadInitialCatalog = async () => {
      try {
        setStepCatalog(await fetchStepCatalog());
      } catch (error) {
        console.error('[StepCatalogStore] Erro ao carregar catálogo:', error);
      } finally {
        setLoading(false);
      }
    };
    void loadInitialCatalog();
  }, []);

  return (
    <StepCatalogContext.Provider value={{ stepCatalog, loading, loadCatalog }}>
      {children}
    </StepCatalogContext.Provider>
  );
};
