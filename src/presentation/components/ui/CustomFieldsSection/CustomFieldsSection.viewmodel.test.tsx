// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { CustomFieldValue, FieldDefinition } from '../../../../domain/entities';

/**
 * Issue #10: `hiddenInForm` passava pelo `check` e pelo pacote, e o formulário do registro desenhava o
 * campo assim mesmo. O caminho é o do `hiddenWhen`: o campo continua em `fields` — o valor gravado
 * atravessa o salvar intacto —, só não é desenhado.
 */
vi.mock('styled-components', () => ({ useTheme: () => ({ colors: {} }) }));
vi.mock('../../../shared/useReferenceSearch', () => ({
  useReferenceSearch: () => ({ onQuery: () => undefined, matchesFor: () => new Set() }),
}));
vi.mock('../../../shared/useEnsureReferencedRecords', () => ({ useEnsureReferencedRecords: () => undefined }));
const lookups = { getOptions: () => [], addOption: vi.fn(), recolorOption: vi.fn(), removeOption: vi.fn() };
vi.mock('../../../../stores/useLookups', () => ({ useLookups: () => lookups }));
const authorization = { can: () => true, effectivePermissions: [] };
vi.mock('../../../../stores/useAuthorization', () => ({ useAuthorization: () => authorization }));
const referenceOptions = {};
vi.mock('../../../hooks/useReferenceOptions', () => ({ useReferenceOptions: () => referenceOptions }));
const resolveRecord = () => null;
vi.mock('../../../shared/useRecordResolver', () => ({ useRecordResolver: () => resolveRecord }));
const candidateOf = () => null;
vi.mock('../../../shared/useOptionsFilterCandidate', () => ({ useOptionsFilterCandidate: () => candidateOf }));
vi.mock('../../../shared/useOptionsFilterQueries', () => ({ useOptionsFilterQueries: () => undefined }));
const opener = () => null;
vi.mock('../../../shared/useReferenceOpener', () => ({ useReferenceOpener: () => opener }));
const resolveLabel = (value: string | null | undefined) => value ?? '';
vi.mock('../../../shared/i18n/useT', () => ({ useLabel: () => resolveLabel, useT: () => resolveLabel }));
const effects = { runFieldChangeEffects: vi.fn(), isFieldLoading: () => false };
vi.mock('./useFieldChangeEffects', () => ({ useFieldChangeEffects: () => effects }));

const { useCustomFieldsSectionViewModel } = await import('./CustomFieldsSection.viewmodel');

const field = (key: string, extra: Partial<FieldDefinition> = {}): FieldDefinition =>
  ({ key, label: key, type: 'text', required: false, order: 0, origin: 'plugin', ...extra }) as FieldDefinition;

const FIELDS = [field('name'), field('code', { order: 1, hiddenInForm: true })];

const visibleKeys = (isNew: boolean, values: Record<string, CustomFieldValue>): string[] => {
  const { result } = renderHook(() => useCustomFieldsSectionViewModel({
    fields: FIELDS, values, onChange: vi.fn(), isNew,
  }));
  return result.current.groups.flatMap((group) => group.fields)
    .filter((one) => !result.current.isFieldHidden(one))
    .map((one) => one.key);
};

describe('hiddenInForm no formulário do registro (#10)', () => {
  it('o campo não é desenhado, no registro novo nem no existente', () => {
    expect(visibleKeys(true, {})).toEqual(['name']);
    expect(visibleKeys(false, { name: 'Item', code: 'X-1' })).toEqual(['name']);
  });

  it('o campo continua entre os do formulário: o valor gravado segue com ele', () => {
    const { result } = renderHook(() => useCustomFieldsSectionViewModel({
      fields: FIELDS, values: { name: 'Item', code: 'X-1' }, onChange: vi.fn(),
    }));
    expect(result.current.groups.flatMap((group) => group.fields).map((one) => one.key)).toEqual(['name', 'code']);
    expect(result.current.getString('code')).toBe('X-1');
  });

  it('visibleIn sem "form" também tira o campo do formulário, e vence o atalho (#12)', () => {
    const { result } = renderHook(() => useCustomFieldsSectionViewModel({
      fields: [field('name', { visibleIn: ['form', 'card'] }), field('code', { order: 1, visibleIn: ['card'] })],
      values: { name: 'Item', code: 'X-1' },
      onChange: vi.fn(),
    }));
    const shown = result.current.groups.flatMap((group) => group.fields).filter((one) => !result.current.isFieldHidden(one));
    expect(shown.map((one) => one.key)).toEqual(['name']);
  });
});

