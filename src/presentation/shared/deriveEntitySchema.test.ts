import { describe, expect, it } from 'vitest';
import type { CustomFieldType, FieldDefinition } from '../../domain/entities';
import { deriveFormFields, deriveListRows } from './deriveEntitySchema';

const CONTROL_TYPES: CustomFieldType[] = [
  'text', 'textarea', 'number', 'currency', 'date', 'checkbox', 'select', 'masked', 'reference', 'markdown',
];

const byKey = (fields: FieldDefinition[]): Map<string, FieldDefinition> =>
  new Map(fields.map((field) => [field.key, field]));

describe('deriveFormFields — campos fixos derivam do ENTITY_REGISTRY como FieldDefinition', () => {
  const fields = deriveFormFields('persons');
  const map = byKey(fields);

  it('todo campo derivado é um FieldDefinition válido (mesmo modelo dos campos dinâmicos)', () => {
    for (const field of fields) {
      expect(typeof field.key).toBe('string');
      expect(typeof field.label).toBe('string');
      expect(typeof field.required).toBe('boolean');
      expect(typeof field.order).toBe('number');
      expect(CONTROL_TYPES).toContain(field.type);
    }
  });

  it('control derivado do tipo/negócio; regras de negócio vindas do NativeFieldSpec', () => {
    expect(map.get('type')).toMatchObject({ type: 'select', required: true, optionsAllowUserAdd: true, lookupCollection: 'personTypes' });
    expect(map.get('name')).toMatchObject({ type: 'text', required: true });
    expect(map.get('cpf')?.type).toBe('masked');
    expect(map.get('cpf')?.mask).toBe('cpf');
    expect(map.get('cpf')?.logic?.hiddenWhen).toBeTruthy();
    expect(map.get('email')?.type).toBe('text');
    expect(map.get('birthDate')?.type).toBe('date');
    expect(map.get('notes')?.type).toBe('textarea');
  });

  it('achata objeto em chaves-com-ponto e preserva lookup/opções', () => {
    expect(map.get('address.city')).toMatchObject({ type: 'select', lookupCollection: 'personCities', section: 'Endereço' });
    expect(map.get('address.state')?.type).toBe('select');
    expect(map.get('address.state')?.options).toHaveLength(27);
    expect(map.get('address.zipCode')?.mask).toBe('cep');
  });

  it('respeita ui.form:false (status não entra no formulário)', () => {
    expect(map.has('status')).toBe(false);
  });
});

describe('deriveListRows — linhas do card derivam de ui.list, ordenadas', () => {
  it('retorna as linhas na ordem configurada, com ícone', () => {
    const rows = deriveListRows('persons');
    expect(rows.map((r) => r.key)).toEqual(['cpf', 'cnpj', 'email', 'phone', 'occupation', 'address.city']);
    for (const row of rows) expect(row.icon).toBeTruthy();
  });
});
