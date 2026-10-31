// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, renderHook, screen, within } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import { baseDarkTheme } from '../../../shared/styles/theme';
import { PortalStoreContext, type PortalStoreValue } from '../../../stores/usePortal';
import { PORTAL_RECORDS_WINDOW, type PortalRecord, type PortalScreenInfo } from '../../../domain/entities/Portal';
import { readPortalWidgetSpec, type PortalWidgetSpec } from '../../../domain/schema/ui/portalWidget';
import { PortalTemplateNodes } from './components/PortalTemplateNodes';
import { PortalContent } from './components/PortalContent/PortalContent.view';
import type { PortalViewModel } from './Portal.viewmodel';
import { usePortalWidget } from './usePortalWidget';
import { countPortalWidgetRecords, selectPortalWidgetRecords } from './resolvePortalWidget';

vi.mock('../../shared/i18n/useT', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useT: () => (key: string, params?: Record<string, string>) => (params ? `${key}:${Object.values(params).join(',')}` : key),
  useLabel: () => (value: string | null | undefined) => value ?? '',
}));

const COMPANIES: PortalScreenInfo = {
  id: 'companies',
  collection: 'companies',
  titleSingular: 'Company',
  titlePlural: 'Companies',
  icon: 'building',
  documents: false,
  trackViews: false,
  actions: false,
  uploads: null,
  parent: null,
  fields: [{ key: 'name', label: 'Name', type: 'text' }],
  create: null,
  edit: null,
};

const NOTICES: PortalScreenInfo = {
  ...COMPANIES,
  id: 'notices',
  collection: 'notices',
  titleSingular: 'Notice',
  titlePlural: 'Notices',
  parent: { collection: 'companies' },
  fields: [
    { key: 'subject', label: 'Subject', type: 'text' },
    { key: 'status', label: 'Status', type: 'select', options: [{ key: 'open', label: 'Open' }, { key: 'read', label: 'Read' }] },
    { key: 'deadline', label: 'Deadline', type: 'text' },
    { key: 'companyId', label: 'Company', type: 'reference' },
  ],
};

const company = (id: string, name: string): PortalRecord => ({
  id: `companies__${id}`,
  collection: 'companies',
  recordId: id,
  screenId: 'companies',
  title: name,
  data: { name },
  labels: {},
  parentKeys: [],
  editable: false,
  portalOwner: null,
  updatedAt: null,
});

const notice = (id: string, companyId: string, companyName: string, data: Record<string, unknown>): PortalRecord => ({
  id: `notices__${id}`,
  collection: 'notices',
  recordId: id,
  screenId: 'notices',
  title: String(data.subject),
  data: { ...data, companyId },
  labels: { companyId: companyName },
  parentKeys: [`companies/${companyId}`],
  editable: false,
  portalOwner: null,
  updatedAt: null,
});

/** A convidada é de DUAS empresas: vê os avisos das duas, e cada um diz de qual é. */
const RECORDS: Record<string, PortalRecord[]> = {
  companies: [company('acme', 'Acme'), company('beta', 'Beta')],
  notices: [
    notice('n1', 'acme', 'Acme', { subject: 'Tax review', status: 'open', deadline: '2026-11-20' }),
    notice('n2', 'beta', 'Beta', { subject: 'Missing receipt', status: 'open', deadline: '2026-11-05' }),
    notice('n3', 'acme', 'Acme', { subject: 'Old notice', status: 'read', deadline: '2026-10-01' }),
    notice('n4', 'acme', 'Acme', { subject: 'Address update', status: 'open', deadline: '2026-11-12' }),
  ],
};

const storeWith = (records: Record<string, PortalRecord[]>, loading: string[] = []): PortalStoreValue => ({
  context: { timeZone: 'America/Sao_Paulo', screens: [COMPANIES, NOTICES] },
  recordsByCollection: records,
  isCollectionLoading: (collection: string) => loading.includes(collection),
} as unknown as PortalStoreValue);

const wrapperFor = (store: PortalStoreValue) => ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider theme={baseDarkTheme}>
    <PortalStoreContext.Provider value={store}>{children}</PortalStoreContext.Provider>
  </ThemeProvider>
);

const spec = (raw: unknown): PortalWidgetSpec => {
  const read = readPortalWidgetSpec(raw);
  if (!read) throw new Error('widget sem nada aproveitável');
  return read;
};

const ATTENTION = spec({
  body: [
    { type: 'row', children: [{ type: 'count', collection: 'notices', when: 'status == "open"' }, { type: 'text', text: 'to open' }] },
    {
      type: 'records',
      collection: 'notices',
      when: 'status == "open"',
      orderBy: { field: 'deadline' },
      card: [{ type: 'title' }, { type: 'field', field: 'companyId' }],
    },
    {
      type: 'records',
      collection: 'companies',
      card: [{ type: 'title' }, { type: 'count', collection: 'notices', when: 'status == "open"', scope: 'record', size: 'sm' }],
    },
  ],
});

const resolve = (widget: PortalWidgetSpec, store = storeWith(RECORDS)) =>
  renderHook(() => usePortalWidget(), { wrapper: wrapperFor(store) }).result.current(widget);

describe('o widget declarado da home, para a convidada de duas empresas', () => {
  it('conta, lista e agrupa sobre os registros das duas — cada aviso dizendo de qual empresa é', () => {
    const onOpen = vi.fn();
    const { nodes, loading } = resolve(ATTENTION);
    expect(loading).toBe(false);

    render(<PortalTemplateNodes nodes={nodes} onOpen={onOpen} />, { wrapper: wrapperFor(storeWith(RECORDS)) });

    expect(screen.getByText('3')).toBeTruthy();
    const buttons = screen.getAllByRole('button');
    // Os três abertos pelo prazo, das duas empresas; depois as empresas, cada uma com os abertos DELA.
    expect(buttons.map((button) => button.textContent)).toEqual([
      'Missing receiptBeta',
      'Address updateAcme',
      'Tax reviewAcme',
      'Acme2',
      'Beta1',
    ]);
    expect(screen.queryByText('Old notice')).toBeNull();

    fireEvent.click(within(buttons[0]).getByText('Missing receipt'));
    expect(onOpen).toHaveBeenCalledWith('notices', 'notices__n2');
  });

  it('sem cartão próprio, o registro sai com o cartão que a tela usa no portal', () => {
    const { nodes } = resolve(spec({ body: [{ type: 'records', collection: 'notices', when: 'status == "read"' }] }));
    render(<PortalTemplateNodes nodes={nodes} onOpen={vi.fn()} />, { wrapper: wrapperFor(storeWith(RECORDS)) });
    const card = screen.getByRole('button');
    expect(within(card).getByText('Old notice')).toBeTruthy();
    expect(within(card).getByText(/Subject: Old notice/)).toBeTruthy();
  });

  it('sem nada a mostrar e sem texto de vazio, o widget não tem o que desenhar — e com o texto, diz', () => {
    expect(resolve(spec({ body: [{ type: 'records', collection: 'notices', when: 'status == "archived"' }] })).nodes).toEqual([]);

    const { nodes } = resolve(spec({ body: [{ type: 'records', collection: 'notices', when: 'status == "archived"', empty: 'All caught up' }] }));
    render(<PortalTemplateNodes nodes={nodes} />, { wrapper: wrapperFor(storeWith(RECORDS)) });
    expect(screen.getByText('All caught up')).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('enquanto uma tela lida não chegou, o widget espera — um zero agora seria falso', () => {
    expect(resolve(ATTENTION, storeWith({ companies: RECORDS.companies }, ['notices'])).loading).toBe(true);
  });

  it('com a janela de registros cheia, a contagem é um piso, e diz isso', () => {
    const many = Array.from({ length: PORTAL_RECORDS_WINDOW }, (_, index) =>
      notice(`m${index}`, 'acme', 'Acme', { subject: `N${index}`, status: 'open' }));
    const { nodes } = resolve(spec({ body: [{ type: 'count', collection: 'notices' }] }), storeWith({ notices: many }));
    expect(nodes).toEqual([expect.objectContaining({ kind: 'count', text: `portal.widget.count.capped:${PORTAL_RECORDS_WINDOW}` })]);
  });

  it('a tela que não está no portal desta convidada não lista nada', () => {
    expect(resolve(spec({ body: [{ type: 'records', collection: 'inspections', empty: 'none' }] })).nodes).toEqual([]);
  });
});

describe('o widget declarado na home', () => {
  const home = (widgets: unknown[], openRecord = vi.fn()) => {
    const vm = {
      emptyScreens: false,
      creating: null,
      atHome: true,
      justSubmitted: false,
      justSaved: false,
      openRecord,
      entryMissing: false,
      pageView: null,
      openedRecord: null,
      detailView: null,
      selected: null,
      listView: null,
      records: [],
      recordsLoading: false,
      home: { title: 'Hello', welcome: '', widgets, Component: null },
    } as unknown as PortalViewModel;
    render(<PortalContent vm={vm} />, { wrapper: wrapperFor(storeWith(RECORDS)) });
    return openRecord;
  };

  it('fica ao lado do cartão de código, com o título que a extensão deu, e abre o registro pela casca', () => {
    const CodeWidget = () => <span>code widget</span>;
    const openRecord = home([
      { id: 'a.due', title: 'Due soon', Component: null, nodes: resolve(ATTENTION).nodes, loading: false },
      { id: 'a.code', title: 'Orders', Component: CodeWidget, nodes: null, loading: false },
    ]);
    expect(screen.getByText('Due soon')).toBeTruthy();
    expect(screen.getByText('code widget')).toBeTruthy();
    fireEvent.click(screen.getByText('Tax review'));
    expect(openRecord).toHaveBeenCalledWith('notices', 'notices__n1');
    expect(screen.queryByText('portal.home.empty')).toBeNull();
  });

  it('enquanto espera os registros, mostra a espera, e não um painel vazio', () => {
    home([{ id: 'a.due', title: 'Due soon', Component: null, nodes: [], loading: true }]);
    expect(screen.getByText('Due soon')).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });
});

describe('a escolha dos registros do widget', () => {
  const notices = RECORDS.notices;

  it('filtra pela projeção, ordena nas duas direções com o vazio no fim, e limita', () => {
    const withEmpty = [...notices, notice('n5', 'beta', 'Beta', { subject: 'No date', status: 'open' })];
    const subjects = (records: PortalRecord[]) => records.map((record) => record.data.subject);

    expect(subjects(selectPortalWidgetRecords(withEmpty, { when: 'status == "open"', orderBy: { field: 'deadline' } })))
      .toEqual(['Missing receipt', 'Address update', 'Tax review', 'No date']);
    expect(subjects(selectPortalWidgetRecords(withEmpty, { when: 'status == "open"', orderBy: { field: 'deadline', direction: 'desc' }, limit: 2 })))
      .toEqual(['Tax review', 'Address update']);
    // Sem ordem, a de chegada — os atualizados mais recentemente primeiro.
    expect(subjects(selectPortalWidgetRecords(withEmpty, { limit: 2 }))).toEqual(['Tax review', 'Missing receipt']);
  });

  it('a expressão que estoura fecha: nenhum registro passa', () => {
    expect(selectPortalWidgetRecords(notices, { when: 'status ==' })).toEqual([]);
    expect(countPortalWidgetRecords(notices, { when: 'status ==' }, null)).toBe(0);
  });

  it('conta todos, ou só os filhos de um registro', () => {
    expect(countPortalWidgetRecords(notices, { when: 'status == "open"' }, null)).toBe(3);
    expect(countPortalWidgetRecords(notices, { when: 'status == "open"' }, 'companies/beta')).toBe(1);
    expect(countPortalWidgetRecords(notices, {}, 'companies/acme')).toBe(3);
  });
});
