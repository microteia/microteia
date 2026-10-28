import type { MarketplacePlugin } from '../../domain/entities/MarketplacePlugin';
import { querySpecWarnings } from '../../domain/schema/querySpec';
import { packageText } from './messages';
import { querySpecsOf } from './undeclaredPaths';

/**
 * Os passos `query` do pacote que pedem mais do que uma consulta entrega.
 *
 * O motor corta o `limit` no teto sem recusar — uma automação gravada com `limit: 300` roda assim desde
 * sempre —, e por isso o pedido acima do teto passava no `check` e saía na instalação devolvendo menos
 * do que o autor escreveu. Aviso, nunca recusa, pelo mesmo motivo: recusar agora quebraria quem já usa.
 */
export interface QueryCeilingFinding {
  /** Que automação do pacote, resolvida para texto. */
  workflow: string;
  step: string;
  detail: string;
}

export const queryCeilingReport = (pkg: MarketplacePlugin): QueryCeilingFinding[] => {
  const describe = packageText(pkg);
  return querySpecsOf(pkg).flatMap(({ workflow, step, spec }) =>
    querySpecWarnings(spec).map((warning) => ({
      workflow: describe(workflow),
      step,
      detail: describe(warning.error, warning.errorParams),
    })));
};
