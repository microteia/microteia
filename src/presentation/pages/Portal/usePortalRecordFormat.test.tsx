// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { PortalRecord, PortalScreenInfo } from '../../../domain/entities/Portal';

/**
 * `visibleIn` sem `portal` (#12): o campo continua exposto — o servidor manda o valor —, mas a grade padrão
 * e o resumo do cartão o pulam. O nó `field` de um `portal.template` que o nomeie ainda o desenha.
 */
vi.mock('styled-components', () => ({ useTheme: () => ({ colors: {} }) }));
const translate = (key: string) => key;
const format = { formatDate: String, formatMoney: String, formatNumber: String };
vi.mock('../../shared/i18n/useT', () => ({ useT: () => translate, useLocaleFormat: () => format }));
const portal = { context: { timeZone: 'UTC' } };
vi.mock('../../../stores/usePortal', () => ({ usePortal: () => portal }));

const { usePortalRecordFormat } = await import('./usePortalRecordFormat');

const screen = {
  id: 'invoices', collection: 'invoices', titleSingular: 'Invoice', titlePlural: 'Invoices', icon: 'apps',
  documents: false, trackViews: false, actions: false, uploads: null, parent: null, create: null, edit: null,
  fields: [
    { key: 'number', label: 'Number', type: 'text' },
    { key: 'code', label: 'Code', type: 'text', hidden: true },
  ],
} as unknown as PortalScreenInfo;

const record = {
  id: 'invoices__1', collection: 'invoices', recordId: '1', screenId: 'invoices', title: 'Invoice 1',
  data: { number: 'N-1', code: 'X-9' }, labels: {}, parentKeys: [], editable: false,
} as unknown as PortalRecord;

describe('o desenho padrão do portal e o campo fora dele (#12)', () => {
  it('a grade e o resumo pulam o campo; o nó field explícito ainda o acha', () => {
    const { result } = renderHook(() => usePortalRecordFormat());
    const answers = result.current.answersOf(screen, record, 'detail');
    expect(answers.fields.map((field) => field.key)).toEqual(['number']);
    expect(answers.summary).toBe('Number: N-1');
    expect(answers.field('code')?.value).toBe('X-9');
  });
});

describe('o título por campo de lista (#55)', () => {
  const steps = {
    ...screen,
    id: 'steps', collection: 'steps', titleFieldKey: 'status',
    fields: [
      { key: 'status', label: 'Status', type: 'select', options: [{ key: 'in_review', label: 'Em análise' }] },
      { key: 'date', label: 'Date', type: 'date' },
    ],
  } as unknown as PortalScreenInfo;
  const step = {
    ...record, id: 'steps__1', collection: 'steps', screenId: 'steps', title: 'in_review',
    data: { status: 'in_review', date: '2026-11-01' },
  } as unknown as PortalRecord;

  it('o cartão e o registro aberto mostram o RÓTULO da opção, como o resumo', () => {
    const { result } = renderHook(() => usePortalRecordFormat());
    expect(result.current.cardOf(steps, step).title).toBe('Em análise');
    expect(result.current.answersOf(steps, step, 'detail').title).toBe('Em análise');
    expect(result.current.cardOf(steps, step).summary).toBe('Status: Em análise · Date: 2026-11-01');
  });
});
