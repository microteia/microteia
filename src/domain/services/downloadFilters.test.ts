import { describe, expect, it } from 'vitest';
import type { DownloadItem } from '../schema/document/documentDownloads';
import { downloadFormatOf, filterDownloads, NO_ORIGIN } from './downloadFilters';

const NOW = new Date(2026, 9, 17, 12, 0, 0);

const item = (overrides: Partial<DownloadItem>): DownloadItem => ({
  id: 'x',
  name: 'Recibo.pdf',
  url: 'https://x',
  storagePath: 'p',
  contentType: 'application/pdf',
  size: 1,
  ownerId: 'ana',
  visibility: 'owner',
  createdBy: 'ana',
  createdByName: 'Ana',
  createdVia: 'ui',
  createdAt: new Date(2026, 9, 15, 10, 0, 0),
  expiresAt: new Date(2026, 9, 22, 10, 0, 0),
  ...overrides,
});

const ITEMS: DownloadItem[] = [
  item({ id: 'a', name: 'Recibo Ação.pdf', templateKey: 'receipt', origin: { collection: 'financials', recordId: 'f1' } }),
  item({
    id: 'b',
    name: 'Proposta.docx',
    contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    createdBy: 'workflow-engine',
    createdByName: undefined,
    createdVia: 'automation',
    ownerId: null,
    visibility: 'everyone',
    templateKey: 'quote',
    createdAt: new Date(2026, 9, 17, 9, 0, 0),
    expiresAt: null,
  }),
  item({ id: 'c', name: 'Extrato.pdf', createdBy: 'bia', createdVia: 'agent', expiresAt: new Date(2026, 9, 18, 0, 0, 0) }),
];

const ids = (tokens: { key: string; values: string[] }[]) => filterDownloads(ITEMS, tokens, NOW).map((one) => one.id);

describe('filterDownloads', () => {
  it('sem filtro, tudo', () => {
    expect(ids([])).toEqual(['a', 'b', 'c']);
  });

  it('a busca ignora acento e caixa, e alcança o que a tela acrescenta', () => {
    expect(ids([{ key: 'search', values: ['acao'] }])).toEqual(['a']);
    expect(filterDownloads(ITEMS, [{ key: 'search', values: ['ana'] }], NOW, (one) => `${one.name} ${one.createdByName ?? ''}`)
      .map((one) => one.id)).toEqual(['a', 'c']);
  });

  it('quem gerou, por onde, origem, modelo, visibilidade e formato', () => {
    expect(ids([{ key: 'createdBy', values: ['workflow-engine', 'bia'] }])).toEqual(['b', 'c']);
    expect(ids([{ key: 'via', values: ['agent'] }])).toEqual(['c']);
    expect(ids([{ key: 'origin', values: [NO_ORIGIN] }])).toEqual(['b', 'c']);
    expect(ids([{ key: 'template', values: ['receipt'] }])).toEqual(['a']);
    expect(ids([{ key: 'visibility', values: ['everyone'] }])).toEqual(['b']);
    expect(ids([{ key: 'format', values: ['docx'] }])).toEqual(['b']);
  });

  it('o período compara o dia local de geração, nas duas pontas inclusive', () => {
    expect(ids([{ key: 'createdFrom', values: ['2026-10-17'] }])).toEqual(['b']);
    expect(ids([{ key: 'createdTo', values: ['2026-10-15'] }])).toEqual(['a', 'c']);
  });

  it('o vencimento: nas próximas 24 horas, na semana, ou nunca', () => {
    expect(ids([{ key: 'expires', values: ['day'] }])).toEqual(['c']);
    expect(ids([{ key: 'expires', values: ['week'] }])).toEqual(['a', 'c']);
    expect(ids([{ key: 'expires', values: ['never'] }])).toEqual(['b']);
  });

  it('filtros diferentes se somam', () => {
    expect(ids([{ key: 'format', values: ['pdf'] }, { key: 'via', values: ['ui'] }])).toEqual(['a']);
  });

  it('o formato sai do tipo, ou da extensão quando o tipo não diz', () => {
    expect(downloadFormatOf({ contentType: '', name: 'x.DOCX' })).toBe('docx');
    expect(downloadFormatOf({ contentType: 'text/plain', name: 'x.txt' })).toBe('other');
  });
});
