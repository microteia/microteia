import React, { useState, useEffect, useMemo } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions as firebaseFunctions } from '../infrastructure/firebase/config';
import type { ExpressionFunctionDef } from './useExpressionFunctions';
import { ExpressionFunctionStoreContext } from './useExpressionFunctions';
import { useLabel } from '../presentation/shared/i18n/useT';

export const ExpressionFunctionStoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const label = useLabel();
  const [functions, setFunctions] = useState<ExpressionFunctionDef[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadFunctions = async () => {
      try {
        setLoading(true);
        setError(null);

        const getExpressionFunctions = httpsCallable<void, { functions: ExpressionFunctionDef[] }>(
          firebaseFunctions,
          'getExpressionFunctions'
        );

        const result = await getExpressionFunctions();
        setFunctions(result.data.functions);
      } catch (err) {
        console.error('[ExpressionFunctionStore] Erro ao carregar funções:', err);
        setError(err instanceof Error ? err.message : '@core.automation/functions.load-error');
      } finally {
        setLoading(false);
      }
    };

    loadFunctions();
  }, []);

  /**
   * O catálogo vem do backend com a descrição e a categoria em forma de REFERÊNCIA. Resolver aqui —
   * e não em cada tela — também faz a BUSCA casar com o texto que a pessoa está vendo, em vez de
   * casar com a chave.
   */
  const resolved = useMemo(
    () => functions.map((fn) => ({
      ...fn,
      description: label(fn.description),
      category: label(fn.category),
    })),
    [functions, label],
  );

  return (
    <ExpressionFunctionStoreContext.Provider value={{ functions: resolved, loading, error }}>
      {children}
    </ExpressionFunctionStoreContext.Provider>
  );
};
