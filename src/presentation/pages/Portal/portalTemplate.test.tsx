// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import { baseDarkTheme } from '../../../shared/styles/theme';
import { PortalStoreContext, type PortalStoreValue } from '../../../stores/usePortal';
import type { PortalRecord, PortalScreenInfo } from '../../../domain/entities/Portal';
import type { PortalTemplate } from '../../../domain/schema/ui/portalTemplate';
import { PortalChildList } from './components/PortalChildList';
import { PortalContent } from './components/PortalContent/PortalContent.view';
import { resolvePortalNodes, type PortalTemplateAnswers } from './resolvePortalTemplate';
import type { PortalViewModel } from './Portal.viewmodel';

vi.mock('../../shared/i18n/useT', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useT: () => (key: string) => key,
  useLabel: () => (value: string | null | undefined) => value ?? '',
}));

const INVOICES = (template?: PortalTemplate): PortalScreenInfo => ({
  id: 'invoices',
  collection: 'invoices',
  titleSingular: 'Invoice',
  titlePlural: 'Invoices',
  icon: 'file',
  documents: false,
  trackViews: false,
  actions: false,
  uploads: null,
  parent: { collection: 'companies' },
  fields: [
    { key: 'number', label: 'Number', type: 'text' },
    { key: 'amount', label: 'Amount', type: 'number' },
    { key: 'status', label: 'Status', type: 'select', options: [{ key: 'late', label: 'Late' }, { key: 'paid', label: 'Paid' }] },
  ],
  create: null,
  edit: null,
  ...(template ? { template } : {}),
});

const record = (id: string, data: Record<string, unknown>): PortalRecord => ({
  id: `invoices__${id}`,
  collection: 'invoices',
  recordId: id,
  screenId: 'invoices',
  title: String(data.number),
  data,
  labels: {},
  parentKeys: ['companies/acme'],
  editable: false,
  portalOwner: null,
  updatedAt: null,
});

const RECORDS = [record('a', { number: 'NF-1', amount: 1200, status: 'late' }), record('b', { number: 'NF-2', amount: 80, status: 'paid' })];

const store = {
  context: { timeZone: 'America/Sao_Paulo' },
  subscribeChildren: (_collection: string, _parent: string, _max: number, onUpdate: (records: PortalRecord[]) => void) => {
    onUpdate(RECORDS);
    return () => undefined;
  },
} as unknown as PortalStoreValue;

const childList = (template?: PortalTemplate, onOpen = vi.fn()) => {
  render(
    <ThemeProvider theme={baseDarkTheme}>
      <PortalStoreContext.Provider value={store}>
        <PortalChildList
          child={{ collection: 'invoices', title: 'Invoices', screen: INVOICES(template), parentKey: 'companies/acme', createLabel: null }}
          onOpen={onOpen}
          onCreate={vi.fn()}
        />
      </PortalStoreContext.Provider>
    </ThemeProvider>,
  );
  return onOpen;
};

describe('o cartão do portal declarado pela tela', () => {
  it('sem declaração, a aba de filhos é a de sempre: título e a linha dos primeiros campos', () => {
    childList();
    expect(screen.getByText('NF-1')).toBeTruthy();
    expect(screen.getByText('Number: NF-1 · Amount: 1,200 · Status: Late')).toBeTruthy();
  });

  it('declarado, o cartão mostra o que o desenho pede, com o destaque e a condição sobre a projeção', () => {
    const onOpen = childList({
      card: {
        layout: 'grid',
        body: [
          { type: 'field', field: 'amount', variant: 'strong', size: 'xl', label: 'Total' },
          { type: 'field', field: 'status', variant: 'badge' },
          { type: 'text', text: 'Overdue', tone: 'danger', hiddenWhen: 'status != "late"' },
        ],
      },
    });

    expect(screen.queryByText('NF-1')).toBeNull();
    expect(screen.getAllByText('Total:')).toHaveLength(2);
    expect(screen.getByText('1,200')).toBeTruthy();
    expect(screen.getByText('Paid')).toBeTruthy();
    expect(screen.getAllByText('Overdue')).toHaveLength(1);

    fireEvent.click(screen.getByText('1,200'));
    expect(onOpen).toHaveBeenCalledWith('invoices', 'invoices__a');
  });

  it('só o arranjo: o conteúdo é o cartão padrão escrito na DSL', () => {
    childList({ card: { layout: 'grid' } });
    expect(screen.getByText('NF-2')).toBeTruthy();
    expect(screen.getByText('Number: NF-2 · Amount: 80 · Status: Paid')).toBeTruthy();
  });
});

const answers: PortalTemplateAnswers = {
  title: 'NF-1',
  field: (key) => (key === 'amount' ? { key, label: 'Amount', value: '1,200', href: null, color: null } : null),
  fields: [{ key: 'amount', label: 'Amount', value: '1,200', href: null, color: null }],
  summary: '',
  updated: '',
  editLabel: 'portal.edit.open',
  hasActions: false,
  isHidden: () => false,
};

const detail = (body: PortalTemplate['detail'] & object, placesEdit: boolean) => {
  const startEdit = vi.fn();
  const vm = {
    emptyScreens: false,
    creating: null,
    atHome: false,
    atProfile: false,
    home: { title: '', welcome: '', widgets: [], Component: null },
    entryMissing: false,
    pageView: null,
    openedRecord: null,
    detailView: null,
    recordActions: null,
    justSubmitted: false,
    justSaved: false,
    goBack: vi.fn(),
    startEdit,
    selected: {
      title: 'NF-1',
      fields: [],
      hasDocuments: false,
      documents: [],
      documentsLoading: false,
      children: [],
      tabs: [],
      activeTab: '',
      editLabel: 'portal.edit.open',
      body: resolvePortalNodes(body.body ?? [], answers),
      placesEdit,
      placesActions: false,
    },
  } as unknown as PortalViewModel;
  render(<ThemeProvider theme={baseDarkTheme}><PortalContent vm={vm} /></ThemeProvider>);
  return startEdit;
};

describe('o registro aberto declarado pela tela', () => {
  it('o desenho que não posiciona "alterar" não o esconde: o botão fica no lugar de sempre', () => {
    const startEdit = detail({ body: [{ type: 'section', title: 'Totals', children: [{ type: 'field', field: 'amount', size: 'xl' }] }] }, false);
    expect(screen.getByText('Totals')).toBeTruthy();
    expect(screen.getByText('1,200')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /portal\.edit\.open/ }));
    expect(startEdit).toHaveBeenCalledTimes(1);
  });

  it('o desenho que posiciona "alterar" o tem uma vez só, onde o pôs', () => {
    detail({ body: [{ type: 'row', children: [{ type: 'title', size: 'xl' }, { type: 'edit' }] }] }, true);
    expect(screen.getAllByRole('button', { name: /portal\.edit\.open/ })).toHaveLength(1);
    expect(screen.getByText('NF-1')).toBeTruthy();
  });
});
