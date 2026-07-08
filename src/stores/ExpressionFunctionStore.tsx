import React, { createContext, useState, useEffect } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions as firebaseFunctions } from '../infrastructure/firebase/config';

export interface ExpressionFunctionDef {
  name: string;
  description: string;
  signature: string;
  example: string;
  category: string;
  minArgs: number;
  maxArgs?: number;
}

interface ExpressionFunctionStoreState {
  functions: ExpressionFunctionDef[];
  loading: boolean;
  error: string | null;
}

export const ExpressionFunctionStoreContext = createContext<ExpressionFunctionStoreState>({
  functions: [],
  loading: true,
  error: null,
});

export const ExpressionFunctionStoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
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
        setError(err instanceof Error ? err.message : 'Erro ao carregar funções');
      } finally {
        setLoading(false);
      }
    };

    loadFunctions();
  }, []);

  return (
    <ExpressionFunctionStoreContext.Provider value={{ functions, loading, error }}>
      {children}
    </ExpressionFunctionStoreContext.Provider>
  );
};
