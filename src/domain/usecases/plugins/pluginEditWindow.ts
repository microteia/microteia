import type { MarketplacePlugin } from '../../entities/MarketplacePlugin';
import { EDIT_WINDOW_SINCE_KERNEL, editWindowIssue } from '../../schema/editWindow';
import { rangeExcludesBelow } from '../../schema/plugin/semver';
import type { LocalizedIssue } from './pluginReferences';

const ISSUE_MESSAGE = {
  shape: '@core.marketplace/issue.edit-window.shape',
  minutes: '@core.marketplace/issue.edit-window.minutes',
  delete: '@core.marketplace/issue.edit-window.delete',
} as const;

/**
 * O `editWindow` das telas do pacote: a forma e o `kernel`.
 *
 * A forma é recusada aqui, e não só pela regra do Firestore, porque lá a declaração malformada FECHA o
 * registro desde o primeiro instante — falha segura para o escritório, e um defeito que o autor só
 * veria quando ninguém mais conseguisse corrigir um erro de digitação.
 *
 * O `kernel` é de GARANTIA, como o de `portal.visibleWhen`: um kernel anterior descarta a chave ao
 * materializar a tela, e o registro que a extensão promete congelar seguiria editável para sempre, sem
 * aviso. Exigir o kernel faz o antigo recusar o pacote em vez de prometer o que não cumpre.
 */
export const packageEditWindowIssues = (pkg: MarketplacePlugin): LocalizedIssue[] => {
  const declared = (pkg.screens ?? []).filter((screen) => screen.editWindow !== undefined && screen.editWindow !== null);

  const shape = declared.flatMap((screen): LocalizedIssue[] => {
    const issue = editWindowIssue(screen.editWindow);
    return issue ? [{ message: ISSUE_MESSAGE[issue], messageParams: { screen: screen.key } }] : [];
  });

  const kernel = declared.length > 0 && !rangeExcludesBelow(pkg.manifest.kernel ?? '', EDIT_WINDOW_SINCE_KERNEL)
    ? [{
      message: '@core.marketplace/issue.edit-window.kernel',
      messageParams: { screen: declared[0].key, minimum: EDIT_WINDOW_SINCE_KERNEL },
    }]
    : [];

  return [...shape, ...kernel];
};
