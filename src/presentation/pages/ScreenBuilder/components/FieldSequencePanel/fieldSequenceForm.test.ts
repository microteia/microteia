import { describe, expect, it } from 'vitest';
import {
  EMPTY_FIELD_SEQUENCE_FORM,
  fieldSequenceFormIssue,
  fieldSequencePreview,
  fieldTypeSupportsSequence,
  fromFieldSequenceForm,
  toFieldSequenceForm,
} from './fieldSequenceForm';

const on = { ...EMPTY_FIELD_SEQUENCE_FORM, enabled: true };

describe('fieldSequenceForm', () => {
  it('só texto e número guardam um número', () => {
    expect(fieldTypeSupportsSequence('text')).toBe(true);
    expect(fieldTypeSupportsSequence('number')).toBe(true);
    expect(fieldTypeSupportsSequence('date')).toBe(false);
  });

  it('o sorteio de uma extensão não liga a seção; a sequência gravada volta como estava', () => {
    expect(toFieldSequenceForm({ pattern: 'AA0000' }).enabled).toBe(false);
    expect(toFieldSequenceForm({ pattern: 'P-0000', sequence: { scope: 'parent' } }))
      .toEqual({ enabled: true, pattern: 'P-0000', scope: 'parent', resetBy: 'never' });
  });

  it('ida e volta: o que a seção grava é o que ela relê', () => {
    const stored = fromFieldSequenceForm(on, 'text');
    expect(stored).toEqual({ pattern: 'YYYY/000000', sequence: { scope: 'tenant', resetBy: 'year' } });
    expect(toFieldSequenceForm(stored)).toEqual(on);
    expect(fromFieldSequenceForm(EMPTY_FIELD_SEQUENCE_FORM, 'text')).toBeNull();
  });

  it('o campo número guarda o inteiro: sem formato e sem recomeço anual', () => {
    expect(fromFieldSequenceForm(on, 'number')).toEqual({ pattern: '', sequence: { scope: 'tenant', resetBy: 'never' } });
    expect(fieldSequenceFormIssue(on, 'number', false)).toBeNull();
    expect(fieldSequencePreview(on, 'number', 2026)).toBe('1');
  });

  it('recusa o que repetiria o número, com o mesmo portão do pacote', () => {
    expect(fieldSequenceFormIssue(on, 'text', false)).toBeNull();
    expect(fieldSequenceFormIssue({ ...on, pattern: '000000' }, 'text', false)).toBe('pattern-year');
    expect(fieldSequenceFormIssue({ ...on, pattern: 'PROT', resetBy: 'never' }, 'text', false)).toBe('pattern-slot');
    expect(fieldSequenceFormIssue({ ...on, scope: 'parent' }, 'text', false)).toBe('scope-needs-parent');
    expect(fieldSequenceFormIssue({ ...on, scope: 'parent' }, 'text', true)).toBeNull();
  });

  it('mostra o primeiro número que a configuração produz', () => {
    expect(fieldSequencePreview(on, 'text', 2026)).toBe('2026/000001');
    expect(fieldSequencePreview({ ...on, pattern: '' }, 'text', 2026)).toBe('1');
    expect(fieldSequencePreview(EMPTY_FIELD_SEQUENCE_FORM, 'text', 2026)).toBe('');
  });
});
