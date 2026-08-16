import { createContext, useContext, useMemo } from 'react';
import { useLabel } from '../presentation/shared/i18n/useT';

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

/**
 * A resolução dos rótulos acontece AQUI, no hook, e não no provedor.
 *
 * O provedor está montado acima do `TenantLocaleProvider` — que é onde os pacotes de idioma
 * instalados no escritório entram — porque ele carrega um catálogo global, uma vez só. Resolver lá
 * dentro pegava o catálogo de fora, só com o núcleo, e o escritório com português instalado via
 * tudo em inglês. O hook, ao contrário, executa no ponto de CHAMADA, já dentro do idioma do tenant.
 */
export const useExpressionFunctions = (): UseExpressionFunctions => {
  const context = useContext(ExpressionFunctionStoreContext);
  const label = useLabel();

  if (!context) {
    throw new Error('useExpressionFunctions must be used within ExpressionFunctionStoreProvider');
  }

  const functions = useMemo(
    () => context.functions.map((fn) => ({
      ...fn,
      description: label(fn.description),
      category: label(fn.category),
    })),
    [context.functions, label],
  );

  return { ...context, functions };
};
