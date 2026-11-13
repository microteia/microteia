import React, { useState, useEffect, useCallback, type ReactNode } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../infrastructure/firebase/config';
import type { StepDefinitionSummary } from '../domain/entities/WorkflowStepCatalog';
import { StepCatalogContext } from './useStepCatalog';
import { useTenant } from './useTenant';

interface StepCatalogProviderProps {
  children: ReactNode;
}

/**
 * O catálogo é POR ESCRITÓRIO: os passos do núcleo mais os que as extensões ligadas dele declaram. Sem
 * escritório, só o núcleo.
 */
const fetchStepCatalog = async (tenantId: string | null): Promise<StepDefinitionSummary[]> => {
  const getWorkflowStepCatalog = httpsCallable<{ tenantId?: string }, { steps: StepDefinitionSummary[] }>(functions, 'getWorkflowStepCatalog');
  const result = await getWorkflowStepCatalog(tenantId ? { tenantId } : {});
  return result.data.steps;
};

export const StepCatalogProvider: React.FC<StepCatalogProviderProps> = ({ children }) => {
  const [stepCatalog, setStepCatalog] = useState<StepDefinitionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id ?? null;

  const loadCatalog = useCallback(async () => {
    setLoading(true);
    try {
      setStepCatalog(await fetchStepCatalog(tenantId));
    } catch (error) {
      console.error('[StepCatalogStore] Erro ao carregar catálogo:', error);
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  // Outro escritório, outras extensões: o catálogo recarrega.
  useEffect(() => {
    let active = true;
    fetchStepCatalog(tenantId)
      .then((steps) => { if (active) setStepCatalog(steps); })
      .catch((error: unknown) => console.error('[StepCatalogStore] Erro ao carregar catálogo:', error))
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [tenantId]);

  return (
    <StepCatalogContext.Provider value={{ stepCatalog, loading, loadCatalog }}>
      {children}
    </StepCatalogContext.Provider>
  );
};
