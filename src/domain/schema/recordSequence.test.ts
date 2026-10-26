import { describe, expect, it } from 'vitest';
import {
  formatRecordSequenceValue,
  isSequenceField,
  nextRecordSequenceValue,
  omitSequenceFields,
  planRecordSequences,
  readAutoValueSequence,
  recordSequenceCounterId,
  recordSequenceFields,
  recordSequenceIssues,
} from './recordSequence';
import type { RecordSequenceEntry, RecordSequenceField } from './recordSequence';
import { createSchemaContext, RESERVED_COLLECTIONS, resolveRecordSequences } from './screenEntity';

const entry = (pattern: string, extra: Partial<RecordSequenceEntry> = {}): RecordSequenceEntry => ({
  field: 'protocolo',
  counterId: 'x',
  counter: { collection: 'c', field: 'protocolo', parent: '', period: '' },
  pattern,
  numeric: false,
  year: 2026,
  ...extra,
});

const sequenceField = (extra: Partial<RecordSequenceField> = {}): RecordSequenceField => ({
  key: 'protocolo',
  pattern: 'YYYY/000000',
  scope: 'tenant',
  resetBy: 'year',
  numeric: false,
  parentFieldKey: null,
  ...extra,
});

describe('readAutoValueSequence', () => {
  it('sem `sequence` o autoValue continua sendo sorteio', () => {
    expect(readAutoValueSequence({ pattern: 'AA0000' })).toBeNull();
    expect(readAutoValueSequence({ pattern: 'AA0000', sequence: null })).toBeNull();
    expect(readAutoValueSequence(null)).toBeNull();
    expect(isSequenceField({ autoValue: { pattern: 'AA0000' } })).toBe(false);
  });

  it('com `sequence`, os padrões são o escritório e nunca recomeçar', () => {
    expect(readAutoValueSequence({ pattern: '', sequence: {} })).toEqual({ scope: 'tenant', resetBy: 'never' });
    expect(readAutoValueSequence({ pattern: '', sequence: { scope: 'parent', resetBy: 'year' } }))
      .toEqual({ scope: 'parent', resetBy: 'year' });
    expect(isSequenceField({ autoValue: { pattern: '', sequence: {} } })).toBe(true);
  });
});

describe('formatRecordSequenceValue', () => {
  it('os zeros são largura MÍNIMA: o número cresce além deles, nunca é cortado', () => {
    expect(formatRecordSequenceValue(entry('YYYY/000000'), 1)).toBe('2026/000001');
    expect(formatRecordSequenceValue(entry('000'), 1234)).toBe('1234');
    expect(formatRecordSequenceValue(entry('000'), 2234)).toBe('2234');
  });

  it('o zero do ANO não é confundido com o lugar do número', () => {
    expect(formatRecordSequenceValue(entry('PROT-YYYY-0000', { year: 2030 }), 7)).toBe('PROT-2030-0007');
  });

  it('letras são literais: na sequência não há sorteio', () => {
    expect(formatRecordSequenceValue(entry('AA-0000'), 3)).toBe('AA-0003');
  });

  it('só a primeira sequência de zeros é o número; sem zeros, o número vai no fim', () => {
    expect(formatRecordSequenceValue(entry('00-00'), 5)).toBe('05-00');
    expect(formatRecordSequenceValue(entry('N.'), 12)).toBe('N.12');
  });

  it('padrão vazio é o número puro; campo `number` grava o inteiro', () => {
    expect(formatRecordSequenceValue(entry(''), 42)).toBe('42');
    expect(formatRecordSequenceValue(entry('YYYY/0000', { numeric: true }), 42)).toBe(42);
  });
});

describe('nextRecordSequenceValue', () => {
  it('o contador ausente ou ilegível começa do 1; o legível avança um', () => {
    expect(nextRecordSequenceValue(undefined)).toBe(1);
    expect(nextRecordSequenceValue('7')).toBe(1);
    expect(nextRecordSequenceValue(-3)).toBe(1);
    expect(nextRecordSequenceValue(1.5)).toBe(1);
    expect(nextRecordSequenceValue(41)).toBe(42);
  });
});

describe('planRecordSequences', () => {
  const at = new Date('2027-01-01T02:00:00Z');

  it('o período é o ano no fuso do escritório, e é parte do id do contador', () => {
    const plan = planRecordSequences([sequenceField()], {}, 'comunicacoes', at, 'America/Sao_Paulo');
    expect(plan.gaps).toEqual([]);
    expect(plan.entries[0]).toMatchObject({
      counterId: 'comunicacoes|protocolo||2026',
      counter: { collection: 'comunicacoes', field: 'protocolo', parent: '', period: '2026' },
      year: 2026,
    });
    expect(planRecordSequences([sequenceField()], {}, 'comunicacoes', at, 'UTC').entries[0].counterId)
      .toBe('comunicacoes|protocolo||2027');
  });

  it('sem recomeço, um contador só para sempre — mas o `YYYY` continua sendo o ano corrente', () => {
    const plan = planRecordSequences([sequenceField({ resetBy: 'never' })], {}, 'c', at, 'UTC');
    expect(plan.entries[0].counterId).toBe('c|protocolo||');
    expect(plan.entries[0].year).toBe(2027);
  });

  it('no escopo do pai, o pai entra no contador; sem pai, é lacuna e não número', () => {
    const field = sequenceField({ scope: 'parent', parentFieldKey: 'processoId', resetBy: 'never' });
    expect(planRecordSequences([field], { processoId: 'p1' }, 'c', at, 'UTC').entries[0].counterId)
      .toBe('c|protocolo|p1|');
    expect(planRecordSequences([field], {}, 'c', at, 'UTC')).toEqual({
      entries: [],
      gaps: [{ field: 'protocolo', parentField: 'processoId' }],
    });
  });

  it('um id de pai com `/` não monta caminho de contador nenhum', () => {
    const field = sequenceField({ scope: 'parent', parentFieldKey: 'processoId' });
    expect(planRecordSequences([field], { processoId: 'a/b' }, 'c', at, 'UTC').gaps).toHaveLength(1);
  });

  it('o id do contador é o que a regra recompõe a partir do corpo', () => {
    expect(recordSequenceCounterId({ collection: 'c', field: 'f', parent: 'p', period: '2026' })).toBe('c|f|p|2026');
  });
});

describe('omitSequenceFields', () => {
  it('tira só os campos numerados, e não muta o que recebeu', () => {
    const data = { a: 1, protocolo: 'x' };
    expect(omitSequenceFields(data, [{ key: 'protocolo' }])).toEqual({ a: 1 });
    expect(data).toEqual({ a: 1, protocolo: 'x' });
  });
});

describe('resolução na coleção', () => {
  const ctx = createSchemaContext([{
    id: 'andamentos',
    titleSingular: 'Andamento',
    titleFieldKey: 'texto',
    parentFieldKey: 'processoId',
    fields: [
      { key: 'texto', label: 'texto', type: 'text', required: false, order: 0, origin: 'plugin' },
      {
        key: 'ordem', label: 'ordem', type: 'number', required: false, order: 1, origin: 'plugin',
        autoValue: { pattern: '', sequence: { scope: 'parent' } },
      },
      {
        key: 'codigo', label: 'codigo', type: 'text', required: false, order: 2, origin: 'plugin',
        autoValue: { pattern: 'AA0000' },
      },
    ],
  }]);

  it('acha só os campos sequenciais, com o campo do pai resolvido e o tipo numérico reconhecido', () => {
    expect(resolveRecordSequences(ctx, 'andamentos')).toEqual([{
      key: 'ordem', pattern: '', scope: 'parent', resetBy: 'never', numeric: true, parentFieldKey: 'processoId',
    }]);
  });

  it('campo aninhado não é numerado', () => {
    const nested = { key: 'a.b', type: 'string', autoValue: { pattern: '', sequence: {} } };
    expect(recordSequenceFields([nested], null)).toEqual([]);
  });

  it('o nome da coleção dos contadores é reservado: nenhuma tela nasce por cima dela', () => {
    expect(RESERVED_COLLECTIONS.has('recordSequences')).toBe(true);
  });
});

describe('recordSequenceIssues', () => {
  const issues = (field: Record<string, unknown>, hasParent = false) =>
    recordSequenceIssues([{ key: 'protocolo', type: 'text', ...field }], { hasParent }).map((issue) => issue.code);

  it('a declaração certa passa — e o sorteio não é assunto deste validador', () => {
    expect(issues({ autoValue: { pattern: 'YYYY/000000', sequence: { resetBy: 'year' } } })).toEqual([]);
    expect(issues({ type: 'number', autoValue: { pattern: '', sequence: {} } })).toEqual([]);
    expect(issues({ autoValue: { pattern: '', sequence: {} } })).toEqual([]);
    expect(issues({ autoValue: { pattern: 'whatever' } })).toEqual([]);
  });

  it('recomeçar por ano sem `YYYY` repetiria o número do ano anterior', () => {
    expect(issues({ autoValue: { pattern: '000000', sequence: { resetBy: 'year' } } })).toEqual(['pattern-year']);
    expect(issues({ type: 'number', autoValue: { pattern: '', sequence: { resetBy: 'year' } } }))
      .toEqual(['pattern-year']);
  });

  it('o padrão precisa de exatamente um lugar para o número', () => {
    expect(issues({ autoValue: { pattern: 'PROT', sequence: {} } })).toEqual(['pattern-slot']);
    expect(issues({ autoValue: { pattern: '00-00', sequence: {} } })).toEqual(['pattern-slot']);
  });

  it('forma, escopo, recomeço, tipo e pai', () => {
    expect(issues({ autoValue: { pattern: '', sequence: 'yes' } })).toEqual(['shape']);
    expect(issues({ autoValue: { pattern: '', sequence: { scope: 'office', resetBy: 'month' } } }))
      .toEqual(['scope', 'reset']);
    expect(issues({ type: 'date', autoValue: { pattern: '', sequence: {} } })).toEqual(['field-type']);
    expect(issues({ type: 'number', autoValue: { pattern: '000', sequence: {} } })).toEqual(['pattern-numeric']);
    expect(issues({ autoValue: { pattern: '', sequence: { scope: 'parent' } } })).toEqual(['scope-needs-parent']);
    expect(issues({ autoValue: { pattern: '', sequence: { scope: 'parent' } } }, true)).toEqual([]);
    expect(recordSequenceIssues(
      [{ key: 'a.b', type: 'text', autoValue: { pattern: '', sequence: {} } }],
      { hasParent: false },
    ).map((issue) => issue.code)).toEqual(['nested']);
  });
});
