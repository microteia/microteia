import { createContext, useContext } from 'react';

export interface ExpressionFunctionDef {
  name: string;
  description: string;
  signature: string;
  example: string;
  category: string;
  minArgs: number;
  maxArgs?: number;
}

export interface ExpressionFunctionStoreState {
  functions: ExpressionFunctionDef[];
  loading: boolean;
  error: string | null;
}

export const ExpressionFunctionStoreContext = createContext<ExpressionFunctionStoreState>({
  functions: [],
  loading: true,
  error: null,
});

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
