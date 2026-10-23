import type { MarketplacePlugin, ScreenModuleTemplate, TemplateField } from '../../entities/MarketplacePlugin';
import { UI_NAV_POINT } from '../../schema/ui/uiExtensionPoints';
import { FILTER_RANGE_TO_SUFFIX } from '../../services/customFieldValues';
import type { LocalizedIssue } from './pluginReferences';
import { templateSourceId } from './screenModule';

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const CHECKBOX_VALUES = ['true', 'false'];

const text = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() !== '' ? value : undefined;

const isTerm = (term: unknown): term is { key: string; values: string[] } => {
  const candidate = term as { key?: unknown; values?: unknown } | null;
  return !!candidate
    && text(candidate.key) !== undefined
    && Array.isArray(candidate.values)
    && candidate.values.length > 0
    && candidate.values.every((value) => text(value) !== undefined);
};

/**
 * O campo que a chave do termo filtra, ou `undefined`. É a mesma régua da listagem
 * (`useCustomFieldListing`): só campo `filterable` que não seja arquivo, e a data também pela ponta
 * `<chave>:ate`.
 */
const filteredField = (screen: ScreenModuleTemplate, key: string): TemplateField | undefined => {
  const fieldKey = key.endsWith(FILTER_RANGE_TO_SUFFIX) ? key.slice(0, -FILTER_RANGE_TO_SUFFIX.length) : key;
  const field = screen.fields.find((candidate) => candidate.key === fieldKey);
  if (!field?.filterable || field.type === 'file') return undefined;
  if (fieldKey !== key && field.type !== 'date') return undefined;
  return field;
};

/**
 * Os valores que o campo aceita, ou `null` quando aqui não dá para saber: a lista de opções do
 * escritório (`lookupCollection`) e o registro referenciado só existem na instalação.
 */
const acceptedValues = (field: TemplateField): ((value: string) => boolean) | null => {
  if (field.type === 'checkbox') return (value) => CHECKBOX_VALUES.includes(value);
  if (field.type === 'date') return (value) => ISO_DAY.test(value);
  if (field.type === 'select' && !field.lookupCollection && (field.options ?? []).length > 0) {
    const keys = new Set((field.options ?? []).map((option) => option.key));
    return (value) => keys.has(value);
  }
  return null;
};

/**
 * Confere o filtro inicial de cada `ui.nav` (`filter`) contra a tela que o item abre.
 *
 * Um termo que a listagem não reconhece não falha em lugar nenhum: a lista abre inteira, e o
 * atalho deixa de mostrar o que o selo contou — que é o defeito que o `filter` existe para fechar.
 * Por isso a chave é recusada aqui, e não ignorada lá.
 *
 * Só a tela DESTE pacote é conferida campo a campo; a de uma dependência não tem os campos à vista
 * daqui, e o filtro sobre ela passa sem veredito.
 */
export const navFilterIssues = (pkg: MarketplacePlugin): LocalizedIssue[] =>
  (pkg.manifest?.contributes ?? []).flatMap((contribution, index): LocalizedIssue[] => {
    if (contribution?.point !== UI_NAV_POINT) return [];
    const metadata = contribution.metadata ?? {};
    const filter = metadata.filter;
    if (filter === undefined) return [];
    const id = String(contribution.id);
    const where = `contributes[${index}].filter`;

    if (!Array.isArray(filter) || filter.length === 0 || !filter.every(isTerm)) {
      return [{ message: '@core.marketplace/issue.package.nav.filter.shape', messageParams: { id, where } }];
    }

    const screenKey = text(metadata.screen);
    const sourceId = text(metadata.screenSourceId);
    if (screenKey === undefined && sourceId === undefined) {
      return [{ message: '@core.marketplace/issue.package.nav.filter.target', messageParams: { id, where } }];
    }

    const screen = (pkg.screens ?? []).find((candidate) =>
      screenKey !== undefined ? candidate.key === screenKey : templateSourceId(candidate) === sourceId);
    if (!screen) return [];

    return filter.flatMap((term): LocalizedIssue[] => {
      const field = filteredField(screen, term.key);
      if (!field) {
        return [{
          message: '@core.marketplace/issue.package.nav.filter.not-filterable',
          messageParams: { id, key: term.key, screen: screen.key },
        }];
      }
      const accepts = acceptedValues(field);
      if (!accepts) return [];
      return term.values
        .filter((value) => !accepts(value))
        .map((value) => ({
          message: '@core.marketplace/issue.package.nav.filter.value',
          messageParams: { id, key: term.key, value },
        }));
    });
  });
