import { createContext, useContext, useMemo } from 'react';
import type { StepDefinitionSummary } from '../domain/entities/WorkflowStepCatalog';
import { useLabel } from '../presentation/shared/i18n/useT';

export interface StepCatalogContextValue {
  stepCatalog: StepDefinitionSummary[];
  loading: boolean;
  loadCatalog: () => Promise<void>;
}

export const StepCatalogContext = createContext<StepCatalogContextValue | null>(null);

/**
 * Hook para acessar o catálogo de Steps.
 * O catálogo é carregado uma única vez via Cloud Function e mantido em memória.
 * Chame `loadCatalog()` quando precisar garantir que o catálogo está carregado
 * (idempotente — não faz nada se já foi carregado).
 */
/**
 * A resolução dos rótulos acontece AQUI, no hook, e não no provedor.
 *
 * O provedor está montado acima do `TenantLocaleProvider` — que é onde os pacotes de idioma
 * instalados no escritório entram — porque ele carrega um catálogo global, uma vez só. Resolver lá
 * dentro pegava o catálogo de fora, só com o núcleo, e o escritório com português instalado via
 * tudo em inglês. O hook, ao contrário, executa no ponto de CHAMADA, já dentro do idioma do tenant.
 */
export const useStepCatalog = (): StepCatalogContextValue => {
  const context = useContext(StepCatalogContext);
  const label = useLabel();
  if (!context) {
    throw new Error('useStepCatalog deve ser usado dentro de StepCatalogProvider');
  }

  const stepCatalog = useMemo(
    () => context.stepCatalog.map((step) => ({
      ...step,
      name: label(step.name),
      description: label(step.description),
      inputs: step.inputs.map((input) => ({
        ...input,
        label: label(input.label, input.labelParams),
        description: input.description === undefined ? undefined : label(input.description),
        options: input.options?.kind === 'Static'
          ? {
            ...input.options,
            options: input.options.options.map((option) => ({ ...option, label: label(option.label) })),
          }
          : input.options,
      })),
      outputDefinitions: step.outputDefinitions.map((output) => ({
        ...output,
        label: label(output.label),
      })),
    })),
    [context.stepCatalog, label],
  );

  return { ...context, stepCatalog };
};

