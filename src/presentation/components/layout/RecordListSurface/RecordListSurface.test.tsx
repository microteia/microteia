// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import type React from 'react';
import { baseDarkTheme } from '../../../../shared/styles/theme';
import { RecordListSurface } from './RecordListSurface.view';
import type { RecordListViewModel } from '../../../shared/entityScreen/useRecordListViewModel';
import type { EntityRecord, ScreenDefinition } from '../../../../domain/entities';

// A casca da lista é dela mesma, e tem testes próprios; aqui interessa o que a superfície DECIDE
// passar a ela e o cartão que desenha dentro.
vi.mock('../EntityListView', () => ({
  EntityListView: ({ children, layout, cardMinWidth }: { children: React.ReactNode; layout?: string; cardMinWidth?: string }) => (
    <div data-testid="list" data-layout={layout ?? 'unset'} data-width={cardMinWidth ?? 'unset'}>{children}</div>
  ),
}));
vi.mock('./EntityListModals', () => ({ EntityListModals: () => null }));
vi.mock('../../../shared/useSchemaContext', () => ({ useSchemaContext: () => ({}) }));
vi.mock('../../../shared/deriveEntitySchema', () => ({ deriveListRows: () => [] }));
vi.mock('../../../shared/listRows', () => ({ useListRowResolver: () => () => '' }));

const record = { id: 'r1', nome: 'Ana', tagIds: [] } as unknown as EntityRecord;

const definition = {
  id: 'clientes', titleSingular: 'Cliente', titlePlural: 'Clientes', icon: 'person',
  titleFieldKey: 'nome', fields: [], hasTags: false,
} as unknown as ScreenDefinition;

const vm = {
  definition,
  collection: 'clientes',
  isLoading: false,
  records: [record],
  filteredRecords: [record],
  filterTokens: [],
  filterDefs: [],
  savedFiltersScreenKey: 'dyn:clientes',
  tags: [],
  setFilterTokens: vi.fn(),
  canCreate: true,
  openNewRecord: vi.fn(),
  openRecord: vi.fn(),
  getCardItems: () => [{ key: 'cidade', label: 'Cidade', value: 'Recife', type: 'text' }],
  getCardTitle: () => 'Ana',
  getCardSubtitle: () => 'Cliente antiga',
  cardSubtitleIconKey: null,
  getFieldText: () => '',
  getCardImageUrl: () => null,
  getCardActions: () => [],
  getCardFieldItem: () => null,
  getCardAccentColor: () => undefined,
  isCardNodeHidden: () => false,
  recordImport: null,
} as unknown as RecordListViewModel;

const draw = (cardTemplate: ScreenDefinition['cardTemplate'], props: Partial<React.ComponentProps<typeof RecordListSurface>> = {}) =>
  render(
    <ThemeProvider theme={baseDarkTheme}>
      <RecordListSurface vm={vm} definition={{ ...definition, cardTemplate }} {...props} />
    </ThemeProvider>,
  );

const isDefaultCard = () => !!screen.queryByText('Cliente antiga') && !!screen.queryByText('Recife');

describe('RecordListSurface — o cartão declarado não muda nada para quem não declara', () => {
  it('sem cardTemplate: o cartão padrão e a lista sem arranjo informado (a grade de sempre)', () => {
    draw(undefined);
    expect(isDefaultCard()).toBe(true);
    expect(screen.getByTestId('list').dataset).toMatchObject({ layout: 'unset', width: 'unset' });
  });

  it('cardTemplate nulo ou ilegível é o mesmo que ausente', () => {
    draw({ body: 'quebrado' } as unknown as ScreenDefinition['cardTemplate']);
    expect(isDefaultCard()).toBe(true);
    expect(screen.getByTestId('list').dataset.layout).toBe('unset');
  });

  it('só o arranjo: a lista vira coluna única e o cartão continua o padrão', () => {
    draw({ layout: 'list', minWidth: 'lg' });
    expect(isDefaultCard()).toBe(true);
    expect(screen.getByTestId('list').dataset).toMatchObject({ layout: 'list', width: 'lg' });
  });

  it('com body: o cartão é o declarado', () => {
    draw({ body: [{ type: 'title' }, { type: 'text', text: 'Só no template' }] });
    expect(screen.getByText('Só no template')).toBeDefined();
    expect(screen.getByText('Ana')).toBeDefined();
    expect(isDefaultCard()).toBe(false);
  });

  it('quem hospeda com cartão de código continua dono dele — o arranjo declarado ainda vale', () => {
    draw(
      { layout: 'list', body: [{ type: 'text', text: 'Só no template' }] },
      { renderBelowHeader: () => <span>slot da extensão</span> },
    );
    expect(screen.queryByText('Só no template')).toBeNull();
    expect(screen.getByText('slot da extensão')).toBeDefined();
    expect(screen.getByTestId('list').dataset.layout).toBe('list');
  });
});
