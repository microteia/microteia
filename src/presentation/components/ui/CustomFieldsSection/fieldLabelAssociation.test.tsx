// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import { baseDarkTheme } from '../../../../shared/styles/theme';
import type { FieldDefinition } from '../../../../domain/entities';

/**
 * Issue #44: o rótulo do campo era desenhado ao lado do controle sem apontar para ele. O leitor de
 * tela anunciava campos sem nome, e `getByLabel('CEP')` não achava nada — num formulário que a
 * plataforma desenha sozinha, sem código da extensão no meio.
 */
vi.mock('../../../shared/useReferenceSearch', () => ({
  useReferenceSearch: () => ({ onQuery: () => undefined, matchesFor: () => new Set() }),
}));
vi.mock('../../../shared/useEnsureReferencedRecords', () => ({ useEnsureReferencedRecords: () => undefined }));
const lookups = { getOptions: () => [], addOption: vi.fn(), recolorOption: vi.fn(), removeOption: vi.fn() };
vi.mock('../../../../stores/useLookups', () => ({ useLookups: () => lookups }));
const authorization = { can: () => false, effectivePermissions: [] };
vi.mock('../../../../stores/useAuthorization', () => ({ useAuthorization: () => authorization }));
const referenceOptions = { places: [{ value: 'p1', label: 'Head office' }] };
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
const notification = { notify: vi.fn() };
vi.mock('../../../../stores/useNotification', () => ({ useNotification: () => notification }));
const noContributions: never[] = [];
vi.mock('../../../../stores/useKernel', () => ({ useContributions: () => noContributions }));

const { CustomFieldsSection } = await import('./CustomFieldsSection.view');
const { FieldInput } = await import('../FieldInput');

let order = 0;
const field = (key: string, label: string, extra: Partial<FieldDefinition> = {}): FieldDefinition =>
  ({ key, label, type: 'text', required: false, order: order++, origin: 'plugin', ...extra }) as FieldDefinition;

const FIELDS: FieldDefinition[] = [
  field('zip', 'CEP', { type: 'masked', mask: 'cep', placeholder: '00000-000' }),
  field('street', 'Street'),
  field('notes', 'Notes', { type: 'textarea' }),
  field('rooms', 'Rooms', { type: 'number' }),
  field('rent', 'Rent', { type: 'currency' }),
  field('since', 'Since', { type: 'date' }),
  field('opens', 'Opens', { type: 'time' }),
  field('active', 'Active', { type: 'checkbox' }),
  field('photo', 'Photo', { type: 'file' }),
  field('state', 'State', { type: 'select', options: [{ key: 'SP', label: 'São Paulo' }] }),
  field('main', 'Main place', { type: 'reference', refEntity: 'places' }),
  field('others', 'Other places', { type: 'reference', refEntity: 'places', multi: true }),
];

const themed = (node: React.ReactNode) => render(<ThemeProvider theme={baseDarkTheme}>{node}</ThemeProvider>);

describe('o rótulo do campo nomeia o controle (#44)', () => {
  it('cada campo de digitar é achado pelo rótulo, e não pelo placeholder', () => {
    themed(<CustomFieldsSection fields={FIELDS} values={{}} onChange={vi.fn()} />);
    for (const label of ['CEP', 'Street', 'Notes', 'Rooms', 'Rent', 'Since', 'Opens', 'Photo']) {
      expect(screen.getByLabelText(label, { exact: false }), label).toBeTruthy();
    }
    expect(screen.getByRole('textbox', { name: 'CEP' })).toBeTruthy();
  });

  it('a caixa de marcar leva o rótulo do campo junto do próprio texto', () => {
    themed(<CustomFieldsSection fields={FIELDS} values={{}} onChange={vi.fn()} />);
    expect(screen.getByRole('checkbox', { name: /^Active/ })).toBeTruthy();
  });

  it('o seletor (botão) diz o campo E a escolha atual', () => {
    themed(<CustomFieldsSection fields={FIELDS} values={{ state: 'SP', main: 'p1' }} onChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'State São Paulo' })).toBeTruthy();
    expect(screen.getByRole('button', { name: /^Main place Head office/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /^Other places/ })).toBeTruthy();
  });

  it('dois formulários na mesma página não dividem ids', () => {
    themed(
      <>
        <CustomFieldsSection fields={[FIELDS[1]]} values={{}} onChange={vi.fn()} />
        <CustomFieldsSection fields={[FIELDS[1]]} values={{}} onChange={vi.fn()} />
      </>,
    );
    const [first, second] = screen.getAllByLabelText('Street');
    expect(first.id).not.toBe(second.id);
  });

  it('o átomo público `FieldInput` também liga o rótulo', () => {
    themed(<FieldInput field={FIELDS[1]} value="" onChange={vi.fn()} />);
    expect(screen.getByRole('textbox', { name: 'Street' })).toBeTruthy();
  });
});
