import type { MarketplacePlugin } from '../../entities/MarketplacePlugin';
import type { MemberVisibilityIssueCode } from '../../schema/memberVisibility';
import {
  MEMBER_VISIBILITY_MAX_FIELDS,
  MEMBER_VISIBILITY_SINCE_KERNEL,
  memberVisibilityIssues,
} from '../../schema/memberVisibility';
import { rangeExcludesBelow } from '../../schema/plugin/semver';
import type { LocalizedIssue } from './pluginReferences';

const ISSUE_MESSAGE: Record<MemberVisibilityIssueCode, string> = {
  shape: '@core.marketplace/issue.member-visibility.shape',
  'fields-empty': '@core.marketplace/issue.member-visibility.fields-empty',
  'fields-too-many': '@core.marketplace/issue.member-visibility.fields-too-many',
  'field-duplicate': '@core.marketplace/issue.member-visibility.field-duplicate',
  'field-unknown': '@core.marketplace/issue.member-visibility.field-unknown',
  'field-not-member': '@core.marketplace/issue.member-visibility.field-not-member',
  'bypass-invalid': '@core.marketplace/issue.member-visibility.bypass-invalid',
};

/**
 * A `memberVisibility` das telas do pacote: a forma, os campos e o `kernel`.
 *
 * Os campos são conferidos contra os da PRÓPRIA tela, e têm de ser referência a membro: é o uid que a
 * regra compara, e um campo de texto com o nome de alguém nunca casaria — a tela ficaria fechada para
 * todos menos a supervisão, sem nada acusar. A forma é recusada aqui pelo mesmo motivo de `editWindow`:
 * na regra a declaração malformada FECHA, e o autor só veria o defeito quando ninguém lesse nada.
 *
 * O `kernel` é de GARANTIA: um kernel anterior descarta a chave ao materializar a tela, e os registros
 * que a extensão promete restringir seriam lidos por todo membro com a coleção, sem aviso.
 */
export const packageMemberVisibilityIssues = (pkg: MarketplacePlugin): LocalizedIssue[] => {
  const declared = (pkg.screens ?? [])
    .filter((screen) => screen.memberVisibility !== undefined && screen.memberVisibility !== null);

  const shape = declared.flatMap((screen) =>
    memberVisibilityIssues(screen.memberVisibility, screen.fields).map((issue): LocalizedIssue => ({
      message: ISSUE_MESSAGE[issue.code],
      messageParams: {
        screen: screen.key,
        subject: issue.subject ?? '',
        max: String(MEMBER_VISIBILITY_MAX_FIELDS),
      },
    })));

  const kernel = declared.length > 0 && !rangeExcludesBelow(pkg.manifest.kernel ?? '', MEMBER_VISIBILITY_SINCE_KERNEL)
    ? [{
      message: '@core.marketplace/issue.member-visibility.kernel',
      messageParams: { screen: declared[0].key, minimum: MEMBER_VISIBILITY_SINCE_KERNEL },
    }]
    : [];

  return [...shape, ...kernel];
};
