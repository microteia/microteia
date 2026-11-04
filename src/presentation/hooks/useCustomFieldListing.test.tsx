// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { FieldDefinition } from '../../domain/entities';

vi.mock('../../stores/useLookups', () => ({
  useLookups: () => ({
    getOptions: (collection: string) => (collection === 'situacoes'
      ? [{ key: 'pending', label: 'Pendente' }, { key: 'reviewed', label: 'Revisado' }]
      : []),
  }),
}));

vi.mock('./useReferenceOptions', () => ({
  useReferenceOptions: () => ({ people: [{ value: 'p1', label: 'Ana' }] }),
}));

const referenceSearch = { onQuery: () => undefined, matchesFor: () => new Set<string>() };
vi.mock('../shared/useReferenceSearch', () => ({
  useReferenceSearch: () => referenceSearch,
}));

vi.mock('styled-components', () => ({
  useTheme: () => ({ colors: {} }),
}));

const { useCustomFieldListing, FILTER_EMPTY_KEY, FILTER_FILLED_KEY, FILTER_RANGE_TO_SUFFIX } = await import('./useCustomFieldListing');

const dueDate: FieldDefinition = {
  key: 'dueDate',
  label: 'Vencimento',
  type: 'date',
  required: false,
  order: 0,
  filterable: true,
} as FieldDefinition;

const listing = () => renderHook(() => useCustomFieldListing([dueDate])).result.current;

const matches = (iso: string, tokens: Record<string, string[]>): boolean =>
  listing().matchesFilters({ dueDate: iso }, tokens);

/**
 * Numa listagem, a data que interessa é quase sempre um INTERVALO — o vencimento do mês, a
 * distribuição do ano. Enquanto o filtro declarado casava data exata, a tela de Financeiro tinha de
 * montar `dueDateFrom`/`dueDateTo` em código, e nenhuma tela do escritório alcançava o mesmo.
 */
describe('filtro de data por intervalo', () => {
  it('oferece as duas pontas do intervalo para o campo de data', () => {
    const range = listing().filterDefs.filter((def) => def.type === 'date');
    expect(range.map((def) => def.key)).toEqual(['dueDate', `dueDate${FILTER_RANGE_TO_SUFFIX}`]);
    expect(range.map((def) => def.label)).toEqual([
      'core.records/filter.range-from',
      'core.records/filter.range-to',
    ]);
  });

  it('as duas pontas são inclusivas', () => {
    const range = { dueDate: ['2026-08-01'], [`dueDate${FILTER_RANGE_TO_SUFFIX}`]: ['2026-08-31'] };
    expect(matches('2026-08-01', range)).toBe(true);
    expect(matches('2026-08-31', range)).toBe(true);
    expect(matches('2026-08-15', range)).toBe(true);
    expect(matches('2026-07-31', range)).toBe(false);
    expect(matches('2026-09-01', range)).toBe(false);
  });

  it('cada ponta vale sozinha', () => {
    expect(matches('2026-08-15', { dueDate: ['2026-08-01'] })).toBe(true);
    expect(matches('2026-07-15', { dueDate: ['2026-08-01'] })).toBe(false);
    expect(matches('2026-07-15', { [`dueDate${FILTER_RANGE_TO_SUFFIX}`]: ['2026-08-01'] })).toBe(true);
    expect(matches('2026-09-15', { [`dueDate${FILTER_RANGE_TO_SUFFIX}`]: ['2026-08-01'] })).toBe(false);
  });

  it('sem filtro nenhum, tudo passa; sem data no registro, o intervalo exclui', () => {
    expect(matches('2026-01-01', {})).toBe(true);
    expect(listing().matchesFilters({}, { dueDate: ['2026-08-01'] })).toBe(false);
  });
});

const status: FieldDefinition = {
  key: 'status',
  label: 'Situação',
  type: 'select',
  required: false,
  order: 0,
  filterable: true,
  lookupCollection: 'situacoes',
} as FieldDefinition;

const statusListing = () => renderHook(() => useCustomFieldListing([status])).result.current;

/**
 * O valor de uma opção é a CHAVE — o que está gravado no registro —, e o rótulo é só o que se lê. Na
 * lista cadastrada no escritório os dois são o mesmo texto, e por isso a troca passava despercebida;
 * na lista cuja chave difere do rótulo (a situação de um push é `pending`, e se lê "Pendente") o
 * filtro não casava registro nenhum e o chip exibia a chave crua.
 */
describe('filtro de lista de opções', () => {
  it('o filtro oferece o rótulo e vale pela chave', () => {
    expect(statusListing().filterDefs[0].options).toEqual([
      { value: 'pending', label: 'Pendente', color: undefined },
      { value: 'reviewed', label: 'Revisado', color: undefined },
    ]);
  });

  it('casa o registro pela chave gravada', () => {
    expect(statusListing().matchesFilters({ status: 'pending' }, { status: ['pending'] })).toBe(true);
    expect(statusListing().matchesFilters({ status: 'reviewed' }, { status: ['pending'] })).toBe(false);
  });

  it('o cartão exibe o rótulo, e não a chave', () => {
    expect(statusListing().displayValue({ status: 'pending' }, status)).toBe('Pendente');
  });
});

const photo: FieldDefinition = {
  key: 'photo',
  label: 'Foto',
  type: 'file',
  required: false,
  order: 0,
  // Marcado como filtrável de propósito: é o que um pacote ou um documento editado à mão pode trazer.
  filterable: true,
  showInList: true,
} as FieldDefinition;

const DOWNLOAD_URL = 'https://firebasestorage.googleapis.com/v0/b/x.appspot.com/o/'
  + 'tenants%2Ft1%2Fpersons%2Fr9%2Ffields%2Fphoto%2F1723000000000_retrato.png'
  + '?alt=media&token=abc-123';

/**
 * As duas exclusões do campo de arquivo, e as duas são silenciosas quando faltam: o `default` de
 * `filterDefs` viraria um filtro de texto sobre URLs, e a busca livre passaria a casar "png" ou
 * "token" em todo registro que tenha imagem.
 */
describe('campo de arquivo na listagem', () => {
  const fileListing = () => renderHook(() => useCustomFieldListing([photo])).result.current;

  it('não vira filtro, mesmo declarado como filtrável', () => {
    expect(fileListing().filterDefs).toEqual([]);
    expect(fileListing().matchesFilters({ photo: DOWNLOAD_URL }, {})).toBe(true);
  });

  it('a URL fica fora do texto varrido pela busca livre', () => {
    const text = fileListing().searchText({ photo: DOWNLOAD_URL, name: 'Maria' });
    expect(text).toContain('maria');
    expect(text).not.toContain('firebasestorage');
    expect(text).not.toContain('token');
  });

  it('o cartão mostra o NOME do arquivo, não a URL', () => {
    expect(fileListing().displayValue({ photo: DOWNLOAD_URL }, photo)).toBe('retrato.png');
    expect(fileListing().cardItems({ photo: DOWNLOAD_URL })[0]).toMatchObject({
      key: 'photo',
      value: 'retrato.png',
      type: 'text',
    });
  });
});

const owner: FieldDefinition = {
  key: 'owner',
  label: 'Responsável',
  type: 'reference',
  required: false,
  order: 1,
  filterable: true,
  refEntity: 'people',
} as FieldDefinition;

const urgent: FieldDefinition = {
  key: 'urgent',
  label: 'Urgente',
  type: 'checkbox',
  required: false,
  order: 2,
  filterable: true,
} as FieldDefinition;

const presenceListing = () => renderHook(() => useCustomFieldListing([dueDate, owner, urgent, photo])).result.current;

/**
 * Toda fila do "que ainda não aconteceu" é um campo vazio — a fatura sem data de pagamento,
 * o chamado sem responsável. O vazio é o do `isEmpty` das expressões, porque é com ele que o selo do
 * menu conta: a lista que o clique abre tem de mostrar exatamente o que o selo contou.
 */
describe('filtro por campo vazio ou preenchido', () => {
  it('oferece o par "Sem valor" / "Com valor" uma vez só, com os campos que podem estar vazios', () => {
    const defs = presenceListing().filterDefs.filter((def) => def.key === FILTER_EMPTY_KEY || def.key === FILTER_FILLED_KEY);
    expect(defs.map((def) => [def.key, def.label, def.type])).toEqual([
      [FILTER_EMPTY_KEY, 'core.records/filter.empty', 'multiselect'],
      [FILTER_FILLED_KEY, 'core.records/filter.filled', 'multiselect'],
    ]);
    // A caixa de seleção nunca está vazia, e o arquivo não filtra.
    expect(defs[0].options).toEqual([{ value: 'dueDate', label: 'Vencimento' }, { value: 'owner', label: 'Responsável' }]);
  });

  it('a tela sem campo filtrável não ganha filtro de presença', () => {
    expect(renderHook(() => useCustomFieldListing([urgent])).result.current.filterDefs.map((def) => def.key)).toEqual(['urgent']);
  });

  it('data: sem valor é ausente, nulo ou texto em branco; preenchida é qualquer data gravada', () => {
    const list = presenceListing();
    const empty = { [FILTER_EMPTY_KEY]: ['dueDate'] };
    const filled = { [FILTER_FILLED_KEY]: ['dueDate'] };
    for (const record of [{}, { dueDate: null }, { dueDate: '' }, { dueDate: '   ' }]) {
      expect(list.matchesFilters(record, empty)).toBe(true);
      expect(list.matchesFilters(record, filled)).toBe(false);
    }
    for (const record of [{ dueDate: '2026-10-31' }, { dueDate: new Date(2026, 9, 31) }]) {
      expect(list.matchesFilters(record, empty)).toBe(false);
      expect(list.matchesFilters(record, filled)).toBe(true);
    }
  });

  it('referência: sem valor é o vínculo ausente ou a lista vazia', () => {
    const list = presenceListing();
    const empty = { [FILTER_EMPTY_KEY]: ['owner'] };
    expect(list.matchesFilters({ owner: '' }, empty)).toBe(true);
    expect(list.matchesFilters({ owner: [] }, empty)).toBe(true);
    expect(list.matchesFilters({ owner: 'p1' }, empty)).toBe(false);
    expect(list.matchesFilters({ owner: ['p1'] }, { [FILTER_FILLED_KEY]: ['owner'] })).toBe(true);
  });

  /** "A enviar" é sem envio E sem cancelamento — "sem um ou outro" não é fila. */
  it('vale para TODOS os campos escolhidos, e soma com os outros filtros', () => {
    const list = presenceListing();
    const queue = { [FILTER_EMPTY_KEY]: ['dueDate', 'owner'] };
    expect(list.matchesFilters({}, queue)).toBe(true);
    expect(list.matchesFilters({ owner: 'p1' }, queue)).toBe(false);
    expect(list.matchesFilters({ owner: 'p1' }, { [FILTER_EMPTY_KEY]: ['dueDate'], [FILTER_FILLED_KEY]: ['owner'] })).toBe(true);
    expect(list.matchesFilters({ owner: 'p1' }, { [FILTER_EMPTY_KEY]: ['dueDate'], owner: ['p2'] })).toBe(false);
  });

  /** Como o token de valor de um campo que deixou de ser filtrável — um filtro salvo antigo não esvazia a lista. */
  it('ignora o campo que não é filtrável por presença', () => {
    expect(presenceListing().matchesFilters({ urgent: true }, { [FILTER_EMPTY_KEY]: ['urgent', 'missing'] })).toBe(true);
  });
});
