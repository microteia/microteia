import type { MarketplacePlugin } from '../../entities/MarketplacePlugin';
import { cardTemplateIssues } from '../../schema/ui/cardTemplateIssues';
import type { LocalizedIssue } from './pluginReferences';

/**
 * Recusa o pacote cujo cartão de listagem não se sustenta: nó que o kernel não conhece, campo que a
 * tela não tem, ícone fora do catálogo, expressão que não parseia. Na tela instalada esses defeitos
 * não quebrariam nada — `readCardTemplate` os descarta —, e é justamente por isso que a recusa mora
 * aqui: descartado em silêncio, o pedaço do cartão só faltaria na tela de quem instalou.
 */
export const packageCardTemplateIssues = (pkg: MarketplacePlugin): LocalizedIssue[] =>
  (pkg.screens ?? []).flatMap((screen, index) =>
    cardTemplateIssues(
      screen.cardTemplate,
      (screen.fields ?? []).map((field) => ({ key: field.key, type: field.type })),
      `screens[${index}].cardTemplate`,
    ),
  );
