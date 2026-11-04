import type { MarketplacePlugin, TemplateField } from '../../entities/MarketplacePlugin';
import { isSearchableFieldType, RECORD_SEARCH_FIELD, SEARCHABLE_FIELD_TYPES } from '../../schema/recordSearch';
import type { LocalizedIssue } from './pluginReferences';

const fieldIssues = (screen: string, field: TemplateField): LocalizedIssue[] => {
  const where = { screen, field: field.key };
  const reserved = field.key === RECORD_SEARCH_FIELD
    ? [{ message: '@core.marketplace/issue.package.field.reserved-key', messageParams: where }]
    : [];
  const type = field.searchable === true && !isSearchableFieldType(field.type)
    ? [{
      message: '@core.marketplace/issue.package.field.searchable.type',
      messageParams: { ...where, type: field.type, types: [...SEARCHABLE_FIELD_TYPES].join(', ') },
    }]
    : [];
  return [...reserved, ...type];
};

/**
 * O que a busca recusa na autoria, em vez de ignorar em execução.
 *
 * Um `searchable` num tipo que a busca não lê não falharia em lugar nenhum: o registro só não seria
 * achado pelo campo, e o autor descobriria pela reclamação de quem procurou. A chave reservada é pior
 * — o campo declarado e os termos disputariam o mesmo lugar no documento, e a regra recusaria a
 * gravação do formulário.
 */
export const packageFieldSearchIssues = (pkg: MarketplacePlugin): LocalizedIssue[] => [
  ...(pkg.screens ?? []).flatMap((screen) => (screen.fields ?? []).flatMap((field) => fieldIssues(screen.key, field))),
  ...(pkg.screenPatches ?? []).flatMap((patch) => (patch.fields ?? []).flatMap((field) => fieldIssues(patch.target, field))),
];
