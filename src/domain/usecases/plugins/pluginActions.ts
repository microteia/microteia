import type { MarketplacePlugin } from '../../entities/MarketplacePlugin';
import type { LocalizedIssue } from './pluginReferences';

const filled = (value: unknown): boolean => typeof value === 'string' && value.trim() !== '';

/**
 * Recusa a ação que não executa nada: sem `workflowId` e sem `command`.
 *
 * O tipo já exige um dos dois, mas o pacote chega como JSON, e `workflowId: ''` — o que se escrevia
 * antes de o tipo aceitar a ação só de comando — satisfaz o tipo sem apontar coisa alguma. Instalada,
 * ela vira um botão que, clicado, não acha o que rodar. É no `check` que o autor ainda pode corrigir.
 */
export const packageActionIssues = (pkg: MarketplacePlugin): LocalizedIssue[] =>
  (pkg.actions ?? []).flatMap((action, index) =>
    filled(action?.workflowId) || filled(action?.command)
      ? []
      : [{
          message: '@core.marketplace/issue.package.action.no-target',
          messageParams: { key: action?.key || action?.templateId || String(index), where: `actions[${index}]` },
        }],
  );
