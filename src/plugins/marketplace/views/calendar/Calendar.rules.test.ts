import { describe, expect, it } from 'vitest';
import {
  byPriority,
  daysOf,
  displayDate,
  fieldKeysOf,
  isOriginHidden,
  moveHandlerFor,
  originsOf,
  positionOf,
  sourceFor,
  statsOf,
  subtitleOf,
  withoutMove,
} from './Calendar.rules';

/**
 * Este é o teste que a divisão em quatro arquivos paga. Tudo o que ele exercita morava dentro do
 * componente — em `useMemo`, em `useCallback` —, e ali a única forma de conferir em que dia um cartão
 * aparece era abrir a tela e olhar. São regras de calendário: erram por um dia, e um erro de um dia
 * numa agenda não se vê olhando.
 */
const record = (fields) => ({ id: 'r', status: 'open', ...fields });

describe('o dia em que o cartão aparece', () => {
  it('é o da data enquanto o item está aberto', () => {
    expect(displayDate(record({ date: '2026-03-10', finishDate: '2026-03-20' })))
      .toEqual(new Date('2026-03-10'));
  });

  /** O que passou é lido onde foi resolvido, não onde estava marcado. */
  it('passa a ser o da conclusão quando o item fecha', () => {
    expect(displayDate(record({ status: 'closed', date: '2026-03-10', finishDate: '2026-03-20' })))
      .toEqual(new Date('2026-03-20'));
  });

  it('não existe quando não há data nenhuma', () => {
    expect(displayDate(record({}))).toBeNull();
  });
});

describe('a aposta do arrasto', () => {
  const dragged = record({ id: 'a', date: '2026-03-10T00:00:00' });

  it('mostra o cartão no dia de destino enquanto a origem não respondeu', () => {
    const moves = { a: { from: '2026-03-10', to: '2026-03-12' } };
    expect(positionOf(dragged, moves)).toEqual({ key: '2026-03-12', pending: true });
  });

  /**
   * A aposta se desfaz SOZINHA: ela só vale enquanto o registro ainda está onde estava. É o que
   * permite a origem decidir um TERCEIRO dia sem a agenda arbitrar nada.
   */
  it('devolve o comando ao dado assim que a escrita chega', () => {
    const moves = { a: { from: '2026-03-09', to: '2026-03-12' } };
    expect(positionOf(dragged, moves)).toEqual({ key: '2026-03-10', pending: false });
  });

  it('e é descartada quando a origem recusa', () => {
    expect(withoutMove({ a: { from: null, to: 'x' }, b: { from: null, to: 'y' } }, 'a'))
      .toEqual({ b: { from: null, to: 'y' } });
  });
});

describe('as colunas do mês', () => {
  const march = new Date(2026, 2, 1);

  it('são uma por dia, com o hoje marcado uma única vez', () => {
    const days = daysOf([], march, {}, 'en', new Date(2026, 2, 17));
    expect(days).toHaveLength(31);
    expect(days.filter((day) => day.isToday).map((day) => day.key)).toEqual(['2026-03-17']);
  });

  it('põem o item mais urgente no topo da coluna', () => {
    const records = [
      record({ id: 'baixa', date: '2026-03-05T00:00:00', priority: 'low' }),
      record({ id: 'critica', date: '2026-03-05T00:00:00', priority: 'critical' }),
      record({ id: 'media', date: '2026-03-05T00:00:00', priority: 'medium' }),
    ];
    const day = daysOf(records, march, {}, 'en', march).find((one) => one.key === '2026-03-05');
    expect(day.items.map((item) => item.record.id)).toEqual(['critica', 'media', 'baixa']);
  });

  it('e uma prioridade que ninguém declarou vai para o fim, em vez de reprovar', () => {
    expect(byPriority({ priority: 'inventada' }, { priority: 'low' })).toBeGreaterThan(0);
  });
});

describe('a conta do mês', () => {
  const march = new Date(2026, 2, 1);
  const now = new Date(2026, 2, 17);

  /** O atrasado sai do pendente: contá-lo nos dois é dizer duas vezes a mesma coisa. */
  it('separa atrasado de pendente, e conta o fechado à parte', () => {
    const records = [
      record({ id: 'atrasado', date: '2026-03-10T00:00:00' }),
      record({ id: 'pendente', date: '2026-03-20T00:00:00' }),
      record({ id: 'fechado', status: 'closed', date: '2026-03-02T00:00:00', finishDate: '2026-03-03T00:00:00' }),
    ];
    expect(statsOf(records, march, now)).toEqual({ total: 3, pending: 1, closed: 1, late: 1 });
  });

  it('ignora o que aparece em outro mês', () => {
    expect(statsOf([record({ date: '2026-04-02T00:00:00' })], march, now).total).toBe(0);
  });

  /** Um item resolvido hoje nunca esteve atrasado. */
  it('não chama de atrasado o que já foi concluído', () => {
    const closed = record({ status: 'closed', date: '2026-03-01T00:00:00', finishDate: '2026-03-17T00:00:00' });
    expect(statsOf([closed], march, now).late).toBe(0);
  });
});

describe('quem responde ao arrasto', () => {
  const visible = () => true;
  const contribution = (id, origem, key) => ({ id, metadata: { origem, key } });

  it('é a primeira contribuição que serve àquela origem', () => {
    const contributions = [contribution('a', 'contracts'), contribution('b', '')];
    expect(moveHandlerFor(contributions, record({ origem: 'invoices' }), [], visible).id).toBe('b');
  });

  /** A ordem é a que o escritório definiu nas Configurações, não a de registro. */
  it('respeita a ordem e o que o escritório desligou', () => {
    const contributions = [contribution('a', '', 'primeira'), contribution('b', '', 'segunda')];
    const layout = [{ key: 'segunda' }, { key: 'primeira' }];
    expect(moveHandlerFor(contributions, record({}), layout, visible).id).toBe('b');
    expect(moveHandlerFor(contributions, record({}), [{ key: 'segunda', enabled: false }], visible).id).toBe('a');
  });

  it('e não devolve nada quando ninguém serve — a agenda não escreve por conta própria', () => {
    expect(moveHandlerFor([contribution('a', 'contracts')], record({ origem: 'invoices' }), [], visible))
      .toBeUndefined();
  });
});

/**
 * A origem se apresenta pela DECLARAÇÃO, e a declaração é lida no render — nunca gravada no item. É o
 * que faz uma mudança de etiqueta ou de subtítulo alcançar os itens que já estão na agenda.
 */
describe('como uma origem se apresenta', () => {
  const source = (id, origem, key) => ({ id, metadata: { origem, key } });

  it('casa a origem EXATA — uma declaração vazia não veste os cartões dos outros', () => {
    const contributions = [source('a', ''), source('b', 'invoices')];
    expect(sourceFor(contributions, 'invoices', []).id).toBe('b');
    expect(sourceFor(contributions, 'contracts', [])).toBeUndefined();
    expect(sourceFor(contributions, '', [])).toBeUndefined();
  });

  it('com duas declarações para a mesma origem, vale a ordem do escritório', () => {
    const contributions = [source('a', 'invoices', 'primeira'), source('b', 'invoices', 'segunda')];
    expect(sourceFor(contributions, 'invoices', [{ key: 'segunda' }, { key: 'primeira' }]).id).toBe('b');
  });

  /** Desligar esconde; quem não declarou nada não tem o que desligar, e continua aparecendo. */
  it('só some da agenda a origem que o escritório desligou', () => {
    const contributions = [source('a', 'invoices', 'faturas')];
    expect(isOriginHidden(contributions, 'invoices', [{ key: 'faturas', enabled: false }])).toBe(true);
    expect(isOriginHidden(contributions, 'invoices', [{ key: 'faturas', enabled: true }])).toBe(false);
    expect(isOriginHidden(contributions, 'invoices', [])).toBe(false);
    expect(isOriginHidden(contributions, 'contracts', [{ key: 'faturas', enabled: false }])).toBe(false);
  });

  it('o subtítulo junta o texto dos campos nomeados, na ordem, pulando os vazios', () => {
    const fieldText = (item, key) => (item[key] == null ? '' : String(item[key]));
    const item = record({ number: '0001', person: '', court: 'TJ' });
    expect(subtitleOf(item, ['number', 'person', 'court'], fieldText)).toBe('0001 · TJ');
    expect(subtitleOf(item, [], fieldText)).toBe('');
  });

  it('uma lista de campos declarada errada vira lista vazia, em vez de reprovar o render', () => {
    expect(fieldKeysOf(['a', '', 3, 'b'])).toEqual(['a', 'b']);
    expect(fieldKeysOf('a')).toEqual([]);
    expect(fieldKeysOf(undefined)).toEqual([]);
  });

  it('as origens presentes aparecem uma vez cada, na ordem em que surgem', () => {
    const items = [record({ origem: 'b' }), record({ origem: 'a' }), record({ origem: 'b' }), record({})];
    expect(originsOf(items)).toEqual(['b', 'a']);
  });
});
