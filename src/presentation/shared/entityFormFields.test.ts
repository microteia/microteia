import { describe, expect, it } from 'vitest';
import type { FieldDefinition } from '../../domain/entities';
import { applyNativeOverride, deriveFormFields, isHiddenByOverride } from './deriveEntitySchema';
import { resolveOnChangePatch } from '../../domain/schema/fieldChangeSpec';
import { buildOptionsScreenKeyResolver, mergeFormFields } from './entityFormFields';

const field = (
  overrides: Partial<FieldDefinition> & Pick<FieldDefinition, 'key' | 'label' | 'order'>,
): FieldDefinition => ({
  type: 'text',
  required: false,
  ...overrides,
});

describe('applyNativeOverride', () => {
  const base = field({
    key: 'zipCode',
    label: 'CEP',
    order: 13,
    section: 'Endereço',
    logic: { validate: "if(isEmpty(value), 'obrigatório', null)", hiddenWhen: 'false' },
  });

  it('sem override, devolve o campo intacto', () => {
    expect(applyNativeOverride(base, undefined)).toBe(base);
  });

  it('sobrescreve rótulo, seção e ordem', () => {
    const next = applyNativeOverride(base, { label: 'Código postal', section: 'Localização', order: 2 });
    expect(next.label).toBe('Código postal');
    expect(next.section).toBe('Localização');
    expect(next.order).toBe(2);
  });

  it('MESCLA logic em vez de substituir — validate do código é preservado', () => {
    const next = applyNativeOverride(base, { logic: { hiddenWhen: "tipo == 'PJ'" } });
    expect(next.logic?.validate).toBe(base.logic?.validate);
    expect(next.logic?.hiddenWhen).toBe("tipo == 'PJ'");
  });

  it('rótulo vazio não apaga o do código', () => {
    expect(applyNativeOverride(base, { label: '   ' }).label).toBe('CEP');
  });

  it('placeholder e seção vazios viram null (limpar é intencional)', () => {
    const next = applyNativeOverride(base, { placeholder: '  ', section: '' });
    expect(next.placeholder).toBe(null);
    expect(next.section).toBe(null);
  });

  it('não deixa o override tocar em tipo, obrigatoriedade ou regras', () => {
    const next = applyNativeOverride(base, { label: 'X' } as never);
    expect(next.type).toBe(base.type);
    expect(next.required).toBe(base.required);
    expect(next.rules).toBe(base.rules);
  });
});

describe('isHiddenByOverride', () => {
  it('só esconde quando explicitamente marcado', () => {
    expect(isHiddenByOverride('a', { a: { hiddenInForm: true } })).toBe(true);
    expect(isHiddenByOverride('a', { a: { hiddenInForm: false } })).toBe(false);
    expect(isHiddenByOverride('a', { a: { label: 'X' } })).toBe(false);
    expect(isHiddenByOverride('a', null)).toBe(false);
  });
});

describe('mergeFormFields', () => {
  const native = [
    field({ key: 'nome', label: 'Nome', order: 0 }),
    field({ key: 'cpf', label: 'CPF', order: 5 }),
  ];
  const custom = [
    field({ key: 'extra1', label: 'Extra 1', order: 0 }),
    field({ key: 'extra2', label: 'Extra 2', order: 1 }),
  ];

  it('antes da unificação, adicionais vêm DEPOIS dos fixos apesar da ordem colidir', () => {
    const merged = mergeFormFields(native, custom, false);
    expect(merged.map((f) => f.key)).toEqual(['nome', 'cpf', 'extra1', 'extra2']);
  });

  it('o deslocamento preserva a ordem relativa entre os adicionais', () => {
    const merged = mergeFormFields(native, [custom[1], custom[0]], false);
    expect(merged.map((f) => f.key)).toEqual(['nome', 'cpf', 'extra1', 'extra2']);
  });

  it('depois da unificação, a ordem gravada vale para os dois — permite intercalar', () => {
    const merged = mergeFormFields(
      [field({ key: 'nome', label: 'Nome', order: 0 }), field({ key: 'cpf', label: 'CPF', order: 2 })],
      [field({ key: 'extra1', label: 'Extra 1', order: 1 })],
      true,
    );
    expect(merged.map((f) => f.key)).toEqual(['nome', 'extra1', 'cpf']);
  });

  it('sem campos adicionais, devolve só os fixos ordenados', () => {
    expect(mergeFormFields(native, [], false).map((f) => f.key)).toEqual(['nome', 'cpf']);
  });

  it('sem campos fixos, os adicionais não são deslocados para trás', () => {
    expect(mergeFormFields([], custom, false).map((f) => f.order)).toEqual([0, 1]);
  });
});

describe('cadeia completa — ajuste no campo do sistema preenche um campo adicional', () => {
  it('onChange configurado em campo fixo devolve o patch para o campo adicional', () => {
    const derived = deriveFormFields('persons', {
      nativeOverrides: { name: { logic: { onChange: 'object("apelido", name)' } } },
    });
    const nameField = derived.find((f) => f.key === 'name');
    expect(nameField?.logic?.onChange).toBe('object("apelido", name)');

    const apelido = field({ key: 'apelido', label: 'Apelido', order: 99 });
    const patch = resolveOnChangePatch(
      nameField as FieldDefinition,
      [...derived, apelido],
      { name: 'Ana' },
      'Ana Maria',
      () => null,
    );

    // A chave é a do campo no formulário (plana). `customValues` só existe no payload gravado,
    // montado por formValuesToStoredValues no save.
    expect(patch).toEqual({ apelido: 'Ana Maria' });
  });
});

describe('buildOptionsScreenKeyResolver', () => {
  const resolve = buildOptionsScreenKeyResolver('persons', new Set(['extra1']));

  it('campo adicional indexa opções na tela; campo fixo, na chave própria', () => {
    expect(resolve(field({ key: 'extra1', label: 'Extra', order: 0 }))).toBe('persons');
    expect(resolve(field({ key: 'gender', label: 'Sexo', order: 0 }))).toBe('persons-native');
  });
});
