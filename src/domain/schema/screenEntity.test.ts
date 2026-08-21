import { describe, expect, it } from 'vitest';
import type { AuditAction } from '../entities/AuditLog';
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
import type { SchemaScreen } from './screenEntity';

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
    id: 'financials',
    titleSingular: 'Financeiro',
    titleFieldKey: 'category',
    fields: [
      field({ key: 'apelido', label: 'Apelido', order: 50 }),
      field({ key: 'category', label: 'Categoria do lançamento', origin: 'builtin', required: true, order: 1 }),
    ],
  },
  /**
   * Pessoa é declarada por extensão: o endereço vem em caminho pontilhado, e o objeto aninhado
   * NASCE da declaração — não há mais entidade em código para trazer o ramo.
   */
  {
    id: 'pessoas',
    collection: 'persons',
    titleSingular: 'Pessoa',
    titleFieldKey: 'name',
    fields: [
      field({ key: 'name', label: 'Nome' }),
      field({ key: 'address.city', label: 'Município', order: 18 }),
      field({ key: 'address.street', label: 'Rua', order: 19 }),
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
    const keys = resolveEntityFields(ctx, 'financials').map((f) => f.key);
    // O campo do tenant entra ao final; os fixos continuam todos lá, sem duplicar `category`.
    expect(keys).toContain('apelido');
    expect(keys.filter((key) => key === 'category')).toHaveLength(1);

    const category = resolveEntityFields(ctx, 'financials').find((f) => f.key === 'category');
    expect(category?.label).toBe('Categoria do lançamento');
    expect(category?.origin).toBe('builtin');
  });

  /**
   * A tela declara a FOLHA (`address.city`) e o ramo nasce dela. Sem isso, a chave pontilhada viraria
   * um campo literal na raiz do documento — o objeto aninhado só existiria se o kernel o declarasse,
   * e nenhuma entidade fora do kernel conseguiria ter um.
   */
  it('a tela cria o objeto aninhado a partir do caminho pontilhado', () => {
    const fields = resolveEntityFields(ctx, 'persons');
    expect(fields.some((f) => f.key === 'address.city')).toBe(false);

    const address = fields.find((f) => f.key === 'address');
    expect(address?.type).toBe('object');
    expect(address?.objectFields?.find((f) => f.key === 'city')?.label).toBe('Município');
    // Duas folhas do mesmo ramo entram no MESMO objeto.
    expect(address?.objectFields?.map((f) => f.key)).toStrictEqual(['city', 'street']);
  });

  it('sem tela do tenant, a entidade é exatamente a declarada em código', () => {
    const entity = resolveEntity(createSchemaContext(), 'members');
    expect(entity?.fields.some((f) => f.key === 'name')).toBe(true);
  });

  it('coleção que não é entidade nem tela não resolve', () => {
    expect(resolveEntity(ctx, 'inexistente')).toBeUndefined();
    expect(isEntityCollection(ctx, 'inexistente')).toBe(false);
    expect(isEntityCollection(ctx, 'medico')).toBe(true);
    expect(isEntityCollection(ctx, 'members')).toBe(true);
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

  it('campo de arquivo é escalar string e leva a config de ida e volta', () => {
    const original = field({
      key: 'foto',
      type: 'file',
      file: { extensions: ['png', 'jpg'], maxSizeMb: 3 },
    });
    const spec = fieldDefinitionToNativeSpec(original);
    expect(spec).toMatchObject({ type: 'string', file: { extensions: ['png', 'jpg'], maxSizeMb: 3 } });
    expect(nativeSpecToFieldDefinition(spec, 'foto', 0)).toMatchObject({
      type: 'file',
      file: { extensions: ['png', 'jpg'], maxSizeMb: 3 },
    });
  });

  it('campo de arquivo sem config volta com `file: null`', () => {
    const spec = fieldDefinitionToNativeSpec(field({ key: 'anexo', type: 'file' }));
    expect(spec.file).toBeUndefined();
    expect(nativeSpecToFieldDefinition(spec, 'anexo', 0).file).toBeNull();
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
    expect(screenIdIssue('members')).toBeTruthy();
    expect(screenIdIssue('workflow_executions')).toBeTruthy();
    expect(screenIdIssue('documentTypes')).toBeTruthy();
  });

  it('aceita um nome livre', () => {
    expect(screenIdIssue('medico')).toBeUndefined();
    expect(screenIdIssue('vendas__produto')).toBeUndefined();
  });
});

/**
 * Quais ações de uma coleção geram registro de auditoria é DECLARAÇÃO da tela.
 *
 * A pergunta existe porque há coleção cujo registro nasce de máquina: uma ingestão que grava por conta
 * própria produziria um log por documento recebido, e afogaria a Auditoria justamente onde ela serve —
 * o gesto humano depois. A resposta esteve escrita no kernel, com o nome da coleção de uma extensão
 * dentro dele; o defeito não era o comportamento, era o núcleo conhecer a coleção.
 */
describe('quais ações a coleção audita', () => {
  const screen = (auditActions?: AuditAction[]): SchemaScreen => ({
    id: 'entradas',
    titleSingular: 'Entrada',
    titleFieldKey: 'title',
    fields: [{ key: 'title', label: 'Título', type: 'text', required: true, order: 0, origin: 'plugin' }],
    ...(auditActions ? { auditActions } : {}),
  });

  it('sem declaração, a entidade não restringe nada — audita tudo', () => {
    const ctx = createSchemaContext([screen()]);
    expect(resolveEntity(ctx, 'entradas')?.auditActions).toBeUndefined();
  });

  it('a declaração da tela atravessa até a entidade resolvida', () => {
    const ctx = createSchemaContext([screen(['UPDATE', 'DELETE'])]);
    expect(resolveEntity(ctx, 'entradas')?.auditActions).toEqual(['UPDATE', 'DELETE']);
  });

  /**
   * Duas telas sobre a MESMA coleção: quem sabe que ela é escrita por máquina é a extensão que a
   * trouxe, e não o documento de baseline que leva o nome dela. Mesma razão do prefixo de evento.
   */
  it('entre duas telas da mesma coleção, a declaração não se perde na que leva o nome', () => {
    const daExtensao: SchemaScreen = { ...screen(['UPDATE', 'DELETE']), id: 'ingestao', collection: 'entradas' };
    const doEscritorio: SchemaScreen = { ...screen(), id: 'entradas' };

    const ctx = createSchemaContext([daExtensao, doEscritorio]);
    expect(resolveEntity(ctx, 'entradas')?.auditActions).toEqual(['UPDATE', 'DELETE']);
  });
});
