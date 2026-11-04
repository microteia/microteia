import { describe, it, expect, vi } from 'vitest';
import { DynamicRecordCommandProvider } from './DynamicRecordCommandProvider';
import type { CommandPaletteAppContext } from './ICommandPaletteProvider';
import type { EntityRecord, ScreenDefinition } from '../../../../../domain/entities';

const screen = (over: Partial<ScreenDefinition>): ScreenDefinition => ({
  id: 'processos', tenantId: 't1', origin: 'plugin',
  titleSingular: 'Processo', titlePlural: 'Processos', icon: 'scale',
  fields: [], titleFieldKey: 'titulo', hasNotes: false, hasDocuments: false, hasTags: false,
  listActions: [], viewActionIds: [], cardActionIds: [],
  ownerPluginId: null, managed: null, sidebarOrder: 0, enabled: true,
  createdAt: new Date(0), createdBy: 'u1', updatedAt: new Date(0),
  ...over,
});

const record = (id: string, collection: string, titulo: string): EntityRecord =>
  ({ id, collection, titulo } as unknown as EntityRecord);

const context = (
  screenDefinitions: ScreenDefinition[],
  extra: EntityRecord[] = [],
  recordMatches: ReadonlySet<string> = new Set(),
): CommandPaletteAppContext => ({
  screenDefinitions,
  records: [
    record('p1', 'processos', 'Processo 0841074-10'),
    record('i1', 'intimacoes', '[Push] Movimentação do processo 0841074-10'),
    ...extra,
  ],
  recordMatches,
  can: () => true,
  openTab: vi.fn(),
  close: vi.fn(),
  label: (value: string | null | undefined) => value ?? '',
} as unknown as CommandPaletteAppContext);

const ids = (query: string, screens: ScreenDefinition[]): string[] =>
  DynamicRecordCommandProvider.getItems(query, context(screens)).map((item) => item.id);

const intimacoes = (over: Partial<ScreenDefinition> = {}) => screen({
  id: 'intimacoes', titleSingular: 'Intimação', titlePlural: 'Intimações', ...over,
});

describe('DynamicRecordCommandProvider', () => {
  it('sem a declaração, os registros de todas as telas entram na busca — como sempre', () => {
    expect(ids('10', [screen({}), intimacoes()])).toEqual(['dyn-record:p1', 'dyn-record:i1']);
  });

  it('hideRecordsFromCommandPalette tira os registros da tela do grupo "Registros"', () => {
    expect(ids('10', [screen({}), intimacoes({ hideRecordsFromCommandPalette: true })]))
      .toEqual(['dyn-record:p1']);
  });

  it('o "Abrir <tela>" continua — mesmo com hideFromSidebar, ele é a entrada que sobra', () => {
    const hidden = intimacoes({ hideRecordsFromCommandPalette: true, hideFromSidebar: true });
    expect(ids('intima', [screen({}), hidden])).toEqual(['dyn-screen:intimacoes']);
  });

  it('o registro que o servidor achou por outro campo entra, depois dos que casam pelo título', () => {
    const outside = record('p2', 'processos', 'Curatela 8227479-19');
    const items = DynamicRecordCommandProvider
      .getItems('maria', context([screen({})], [record('p3', 'processos', 'Maria x Banco'), outside], new Set(['processos/p2'])))
      .map((item) => item.id);
    expect(items).toEqual(['dyn-record:p3', 'dyn-record:p2']);
  });

  it('o que o servidor achou numa tela tirada do ⌘K continua fora', () => {
    const found = record('i2', 'intimacoes', 'Intimação qualquer');
    const items = DynamicRecordCommandProvider
      .getItems('isabel', context([screen({}), intimacoes({ hideRecordsFromCommandPalette: true })], [found], new Set(['intimacoes/i2'])))
      .map((item) => item.id);
    expect(items).toEqual([]);
  });
});
