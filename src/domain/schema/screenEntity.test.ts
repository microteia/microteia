import { describe, expect, it } from 'vitest';
import type { FieldDefinition } from '../entities/entitySchemas';
import {
  createSchemaContext,
  fieldDefinitionToNativeSpec,
  isEntityCollection,
  nativeSpecToFieldDefinition,
  resolveEntity,
  resolveEntityFields,
  screenIdIssue,
} from './screenEntity';

const field = (overrides: Partial<FieldDefinition> & Pick<FieldDefinition, 'key'>): FieldDefinition => ({
  label: overrides.key,
  type: 'text',
  required: false,
  order: 0,
  origin: 'design',
  ...overrides,
});

const ctx = createSchemaContext([
  {
    id: 'persons',
    titleSingular: 'Pessoa',
    titleFieldKey: 'name',
    fields: [
      field({ key: 'apelido', label: 'Apelido', order: 50 }),
      field({ key: 'name', label: 'Nome completo', origin: 'builtin', required: true, order: 1 }),
      field({ key: 'address.city', label: 'Município', origin: 'builtin', order: 18 }),
    ],
  },
  {
    id: 'medico',
    titleSingular: 'Médico',
    titlePlural: 'Médicos',
    titleFieldKey: 'nome',
    fields: [
      field({ key: 'nome', label: 'Nome' }),
      field({ key: 'crm', label: 'CRM' }),
    ],
  },
]);

describe('resolveEntity — uma tela é uma entidade', () => {
  it('sintetiza a entidade de uma tela que não existe em código', () => {
    const entity = resolveEntity(ctx, 'medico');
    expect(entity).toMatchObject({
      key: 'medico',
      collection: 'medico',
      eventPrefix: 'medico',
      labelSingular: 'Médico',
      labelPlural: 'Médicos',
      displayNameFields: ['nome'],
      referenceable: true,
    });
    expect(entity?.fields.map((f) => f.key)).toEqual(['nome', 'crm']);
  });

  it('mescla os campos do tenant sobre os declarados em código, na entidade fixa', () => {
    const keys = resolveEntityFields(ctx, 'persons').map((f) => f.key);
    // O campo do tenant entra ao final; os fixos continuam todos lá, sem duplicar `name`.
    expect(keys).toContain('apelido');
    expect(keys.filter((key) => key === 'name')).toHaveLength(1);

    const name = resolveEntityFields(ctx, 'persons').find((f) => f.key === 'name');
    expect(name?.label).toBe('Nome completo');
    expect(name?.origin).toBe('builtin');
  });

  it('um ajuste em caminho pontilhado desce no objeto aninhado, sem achatá-lo', () => {
    const address = resolveEntityFields(ctx, 'persons').find((f) => f.key === 'address');
    expect(address?.type).toBe('object');
    const city = address?.objectFields?.find((f) => f.key === 'city');
    expect(city?.label).toBe('Município');
    // Os irmãos declarados em código continuam intactos.
    expect(address?.objectFields?.some((f) => f.key === 'street')).toBe(true);
  });

  it('sem tela do tenant, a entidade é exatamente a declarada em código', () => {
    const entity = resolveEntity(createSchemaContext(), 'cases');
    expect(entity?.fields.some((f) => f.key === 'caseNumber')).toBe(true);
  });

  it('coleção que não é entidade nem tela não resolve', () => {
    expect(resolveEntity(ctx, 'inexistente')).toBeUndefined();
    expect(isEntityCollection(ctx, 'inexistente')).toBe(false);
    expect(isEntityCollection(ctx, 'medico')).toBe(true);
    expect(isEntityCollection(ctx, 'cases')).toBe(true);
  });
});

describe('conversão FieldDefinition ⇄ NativeFieldSpec', () => {
  it('preserva as propriedades que valem no front E no back', () => {
    const original = field({
      key: 'valor',
      label: 'Valor',
      type: 'currency',
      required: true,
      order: 3,
      section: 'Financeiro',
      rules: { format: { preset: 'digits' } },
      logic: { compute: 'a + b' },
      aggregation: { from: 'itens', via: 'venda', op: 'sum', field: 'total' },
    });

    const roundTrip = nativeSpecToFieldDefinition(fieldDefinitionToNativeSpec(original), 'valor', 3);
    expect(roundTrip).toMatchObject({
      key: 'valor',
      label: 'Valor',
      type: 'currency',
      required: true,
      order: 3,
      origin: 'design',
      section: 'Financeiro',
      rules: { format: { preset: 'digits' } },
      logic: { compute: 'a + b' },
      aggregation: { from: 'itens', via: 'venda', op: 'sum', field: 'total' },
    });
  });

  it('reference múltipla vira lista de ids', () => {
    const spec = fieldDefinitionToNativeSpec(field({ key: 'partes', type: 'reference', refEntity: 'persons', multi: true }));
    expect(spec).toMatchObject({ type: 'stringArray', refEntity: 'persons', multi: true });
  });

  it('campo oculto no formulário vira `ui.form: false`, o mesmo sinal do registro', () => {
    const spec = fieldDefinitionToNativeSpec(field({ key: 'interno', hiddenInForm: true }));
    expect(spec.ui?.form).toBe(false);
    expect(nativeSpecToFieldDefinition(spec, 'interno', 0).hiddenInForm).toBe(true);
  });
});

describe('nomes de coleção reservados', () => {
  it('recusa nome vazio, malformado ou reservado', () => {
    expect(screenIdIssue('')).toBeTruthy();
    expect(screenIdIssue('meu-cadastro')).toBeTruthy();
    expect(screenIdIssue('1medico')).toBeTruthy();
    expect(screenIdIssue('persons')).toBeTruthy();
    expect(screenIdIssue('workflow_executions')).toBeTruthy();
    expect(screenIdIssue('caseAreas')).toBeTruthy();
  });

  it('aceita um nome livre', () => {
    expect(screenIdIssue('medico')).toBeUndefined();
    expect(screenIdIssue('vendas__produto')).toBeUndefined();
  });
});
