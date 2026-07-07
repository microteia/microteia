import { useContext } from 'react';
import type { ExpressionFunctionDef } from './ExpressionFunctionStore';
import { ExpressionFunctionStoreContext } from './ExpressionFunctionStore';

export interface UseExpressionFunctions {
  functions: ExpressionFunctionDef[];
  loading: boolean;
  error: string | null;
}

export const useExpressionFunctions = (): UseExpressionFunctions => {
  const context = useContext(ExpressionFunctionStoreContext);
  
  if (!context) {
    throw new Error('useExpressionFunctions must be used within ExpressionFunctionStoreProvider');
  }

  return context;
};
