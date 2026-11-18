import type { MarketplacePlugin } from '../../entities/MarketplacePlugin';
import { listOrderIssues } from '../../schema/ui/listOrder';
import type { LocalizedIssue } from './pluginReferences';

/**
 * Recusa o pacote cuja ordem de listagem não se sustenta: campo que a tela não tem, tipo que não
 * ordena pelo que se vê, direção desconhecida. Na tela instalada a chave inválida só sairia da ordem
 * (`readListOrder`) — e é por isso que a recusa mora aqui: descartada em silêncio, a lista apareceria
 * numa ordem que o autor não declarou, sem ninguém saber por quê.
 */
export const packageListOrderIssues = (pkg: MarketplacePlugin): LocalizedIssue[] =>
  (pkg.screens ?? []).flatMap((screen, index) =>
    listOrderIssues(
      screen.listOrder,
      (screen.fields ?? []).map((field) => ({ key: field.key, type: field.type, multi: field.multi ?? null })),
      `screens[${index}].listOrder`,
    ),
  );
