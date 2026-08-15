import React, { useState, useEffect, useCallback, useMemo, type ReactNode } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../infrastructure/firebase/config';
import type { StepDefinitionSummary } from '../domain/entities/WorkflowStepCatalog';
import { StepCatalogContext } from './useStepCatalog';
import { useLabel } from '../presentation/shared/i18n/useT';

interface StepCatalogProviderProps {
  children: ReactNode;
}

const fetchStepCatalog = async (): Promise<StepDefinitionSummary[]> => {
  const getWorkflowStepCatalog = httpsCallable<void, { steps: StepDefinitionSummary[] }>(functions, 'getWorkflowStepCatalog');
  const result = await getWorkflowStepCatalog();
  return result.data.steps;
};

export const StepCatalogProvider: React.FC<StepCatalogProviderProps> = ({ children }) => {
  const label = useLabel();
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

  /**
   * O catálogo chega do backend com nome, descrição e rótulos em forma de REFERÊNCIA — lá não há
   * idioma. Resolver aqui, e só aqui, poupa cada tela do editor de saber disso; o que a extensão
   * declarar como texto cru continua passando intacto, que é a regra do `resolveLabel`.
   */
  const resolved = useMemo(
    () => stepCatalog.map((step) => ({
      ...step,
      name: label(step.name),
      description: label(step.description),
      inputs: step.inputs.map((input) => ({
        ...input,
        label: label(input.label),
        description: input.description === undefined ? undefined : label(input.description),
      })),
      outputDefinitions: step.outputDefinitions.map((output) => ({
        ...output,
        label: label(output.label),
      })),
    })),
    [stepCatalog, label],
  );

  return (
    <StepCatalogContext.Provider value={{ stepCatalog: resolved, loading, loadCatalog }}>
      {children}
    </StepCatalogContext.Provider>
  );
};
