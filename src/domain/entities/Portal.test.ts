import { describe, expect, it } from 'vitest';
import { fillPortalWelcome, orderPortalRecords, portalRecordDisplayTitle, portalWelcomeValues } from './Portal';
import type { PortalRecord, PortalScreenInfo } from './Portal';

const base = { accountName: '', email: 'ana@exemplo.com', office: 'Souza Advogados' };

describe('portalWelcomeValues', () => {
  it('usa o nome da conta', () => {
    expect(portalWelcomeValues({ ...base, accountName: 'Bia Lima' })).toMatchObject({ firstName: 'Bia', name: 'Bia Lima' });
  });

  it('sem nome na conta, cai no e-mail', () => {
    expect(portalWelcomeValues(base)).toMatchObject({ firstName: 'ana@exemplo.com', name: 'ana@exemplo.com' });
  });
});

describe('fillPortalWelcome', () => {
  const values = portalWelcomeValues({ ...base, accountName: 'Ana Souza' });

  it('preenche os marcadores conhecidos', () => {
    expect(fillPortalWelcome('Olá, {firstName}! {name} no portal de {office}.', values))
      .toBe('Olá, Ana! Ana Souza no portal de Souza Advogados.');
  });

  it('mantém intacto o marcador desconhecido', () => {
    expect(fillPortalWelcome('Olá, {guest} — {email}', values)).toBe('Olá, {guest} — ana@exemplo.com');
  });

  it('não trata propriedade herdada como marcador', () => {
    expect(fillPortalWelcome('{constructor}', values)).toBe('{constructor}');
  });
});

describe('orderPortalRecords', () => {
  const projection = (id: string, data: Record<string, unknown>, updatedAt: string): PortalRecord => ({
    id, collection: 'invoices', recordId: id, screenId: 'invoices', title: id, data, labels: {},
    parentKeys: [], editable: false, portalOwner: null, updatedAt: new Date(updatedAt),
  });
  const records = [
    projection('a', { amount: 300 }, '2026-03-01T00:00:00Z'),
    projection('b', {}, '2026-03-03T00:00:00Z'),
    projection('c', { amount: 100 }, '2026-03-02T00:00:00Z'),
  ];
  const ids = (list: PortalRecord[]) => list.map((record) => record.id);

  it('sem ordem declarada, a lista fica como a projeção a entregou', () => {
    expect(ids(orderPortalRecords(records, undefined))).toEqual(['a', 'b', 'c']);
  });

  it('o campo é lido em `data`, e o vazio vai para o fim', () => {
    expect(ids(orderPortalRecords(records, [{ path: 'amount', dir: 'asc' }]))).toEqual(['c', 'a', 'b']);
  });

  it('`updatedAt` é o carimbo da projeção', () => {
    expect(ids(orderPortalRecords(records, [{ path: 'updatedAt', dir: 'asc' }]))).toEqual(['a', 'c', 'b']);
  });
});

describe('portalRecordDisplayTitle (#55)', () => {
  const screen = {
    titleFieldKey: 'status',
    fields: [{ key: 'status', label: 'Status', type: 'select', options: [{ key: 'in_review', label: 'Em análise' }, { key: 'done', label: 'Concluída' }] }],
  } as unknown as PortalScreenInfo;

  it('título por `select`: o rótulo da opção, e os rótulos de uma lista múltipla', () => {
    expect(portalRecordDisplayTitle(screen, { title: 'in_review', data: { status: 'in_review' } })).toBe('Em análise');
    expect(portalRecordDisplayTitle(screen, { title: '', data: { status: ['in_review', 'done'] } })).toBe('Em análise, Concluída');
  });

  it('opção que o contexto não conhece fica com a chave; vazio fica com o título projetado', () => {
    expect(portalRecordDisplayTitle(screen, { title: 'old', data: { status: 'old' } })).toBe('old');
    expect(portalRecordDisplayTitle(screen, { title: '', data: {} })).toBe('');
  });

  it('título de texto, ou tela sem o campo de título exposto, é o da projeção', () => {
    expect(portalRecordDisplayTitle({ fields: screen.fields }, { title: 'in_review', data: { status: 'in_review' } })).toBe('in_review');
    expect(portalRecordDisplayTitle(null, { title: 'T', data: {} })).toBe('T');
  });
});
