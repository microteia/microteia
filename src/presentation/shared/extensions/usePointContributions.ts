import { useContext, useMemo } from 'react';
import { KernelContext } from '../../../stores/useKernel';

/**
 * Uma contribuição vista de FORA do Kernel: quem a declarou, a identidade dela e a metadata — nunca
 * a implementação. É o que permite uma extensão publicar um ponto próprio (`calendar.action`) e
 * outra preencher esse ponto sem que nenhuma das duas conheça a outra.
 *
 * A `impl` fica de fora de propósito: resolver implementação é o que carrega código de um plugin no
 * contexto de outro, e o único caminho de execução que a ponte oferece é o declarado — uma Action,
 * endereçada por `sourceId` e executada pelo motor.
 */
export interface PointContribution {
  pluginId: string;
  id: string;
  metadata: Record<string, unknown>;
}

/**
 * As contribuições de um ponto QUALQUER, para código de extensão. Sem `KernelProvider` em volta
 * devolve lista vazia, em vez de quebrar — mesma tolerância do `resolveService` no DI.
 */
export const usePointContributions = (point: string): PointContribution[] => {
  const kernel = useContext(KernelContext);
  const contributions = kernel?.host.contributions.query(point);

  return useMemo(
    () => (contributions ?? []).map((contribution) => ({
      pluginId: contribution.pluginId,
      id: contribution.id,
      metadata: contribution.metadata,
    })),
    [contributions],
  );
};
