import { describe, expect, it } from 'vitest';
import { buildFieldRulePresetCatalog } from './fieldRulePresets';
import { BR_FIELD_RULE_PRESETS } from '../../plugins/marketplace/brasil';

/** CPF e CNPJ vêm da extensão do Brasil; o catálogo abaixo é o de um escritório que a instalou. */
const br = buildFieldRulePresetCatalog(BR_FIELD_RULE_PRESETS);
import {
  applyFormat,
  checkValue,
  DEFAULT_FILE_MAX_SIZE_MB,
  fileConfigIsImageOnly,
  formatAndValidate,
  isEmptyRuleValue,
  resolveFileConfig,
} from './fieldRules';

describe('applyFormat', () => {
  it('aplica um preset', () => {
    expect(applyFormat('52998224725', { preset: 'cpf' }, br)).toBe('529.982.247-25');
    expect(applyFormat('  Ana  ', { preset: 'trim' })).toBe('Ana');
    expect(applyFormat('A@B.COM', { preset: 'lower' })).toBe('a@b.com');
  });

  it('aplica busca e substituição por regex', () => {
    const formatted = applyFormat('52998224725', {
      pattern: '^(\\d{3})(\\d{3})(\\d{3})(\\d{2})$',
      replacement: '$1.$2.$3-$4',
    });
    expect(formatted).toBe('529.982.247-25');
  });

  it('aplica o preset antes do regex', () => {
    const formatted = applyFormat('529.982.247-25', {
      preset: 'digits',
      pattern: '^(\\d{3})(\\d{3})(\\d{3})(\\d{2})$',
      replacement: '$1-$2-$3-$4',
    });
    expect(formatted).toBe('529-982-247-25');
  });

  it('ignora valores não-string e regex inválido', () => {
    expect(applyFormat(42, { preset: 'cpf' })).toBe(42);
    expect(applyFormat(null, { preset: 'cpf' })).toBe(null);
    expect(applyFormat('abc', { pattern: '([', replacement: 'x' })).toBe('abc');
  });
});

describe('checkValue', () => {
  it('nunca reprova valor vazio', () => {
    const rule = { check: 'cpf' as const };
    expect(checkValue('', rule, 'CPF')).toBeUndefined();
    expect(checkValue('   ', rule, 'CPF')).toBeUndefined();
    expect(checkValue(null, rule, 'CPF')).toBeUndefined();
    expect(checkValue(undefined, rule, 'CPF')).toBeUndefined();
    expect(checkValue([], rule, 'CPF')).toBeUndefined();
  });

  it('valida dígito verificador de CPF e CNPJ', () => {
    expect(checkValue('529.982.247-25', { check: 'cpf' }, 'CPF', br)).toBeUndefined();
    expect(checkValue('111.111.111-11', { check: 'cpf' }, 'CPF', br)).toEqual({ error: 'CPF inválido' });
    expect(checkValue('11.222.333/0001-81', { check: 'cnpj' }, 'CNPJ', br)).toBeUndefined();
    expect(checkValue('11.111.111/1111-11', { check: 'cnpj' }, 'CNPJ', br)).toEqual({ error: 'CNPJ inválido' });
  });

  it('valida por regex com mensagem customizada', () => {
    const rule = { pattern: '^\\d{4}$', message: 'Precisa ter 4 dígitos' };
    expect(checkValue('1234', rule, 'Código')).toBeUndefined();
    expect(checkValue('12', rule, 'Código')).toEqual({ error: 'Precisa ter 4 dígitos' });
  });

  it('não reprova quando não há regra', () => {
    expect(checkValue('qualquer coisa', undefined, 'X')).toBeUndefined();
  });
});

describe('formatAndValidate', () => {
  it('formata antes de validar', () => {
    const outcome = formatAndValidate(
      '52998224725',
      { format: { preset: 'cpf' }, validate: { check: 'cpf' } },
      'cpf',
      'CPF',
      br,
    );
    expect(outcome.value).toBe('529.982.247-25');
    expect(outcome.issue).toBeUndefined();
  });

  it('devolve o issue com caminho e rótulo', () => {
    const outcome = formatAndValidate(
      '11111111111',
      { format: { preset: 'cpf' }, validate: { check: 'cpf' } },
      'cpf',
      'CPF',
      br,
    );
    expect(outcome.issue).toEqual({ path: 'cpf', label: 'CPF', error: 'CPF inválido' });
  });

  it('é transparente quando não há regras', () => {
    const outcome = formatAndValidate('  x  ', undefined, 'a', 'A');
    expect(outcome.value).toBe('  x  ');
    expect(outcome.issue).toBeUndefined();
  });
});

describe('isEmptyRuleValue', () => {
  it('trata vazio como ausência de valor', () => {
    expect(isEmptyRuleValue('')).toBe(true);
    expect(isEmptyRuleValue(0)).toBe(false);
    expect(isEmptyRuleValue(false)).toBe(false);
  });
});

describe('config de campo de arquivo', () => {
  it('sem config, aceita qualquer extensão até o teto do Storage', () => {
    expect(resolveFileConfig()).toEqual({ extensions: [], maxSizeMb: DEFAULT_FILE_MAX_SIZE_MB });
    expect(resolveFileConfig(null)).toEqual({ extensions: [], maxSizeMb: DEFAULT_FILE_MAX_SIZE_MB });
  });

  it('normaliza a extensão como o usuário a digita — ponto, caixa, espaço e repetição', () => {
    expect(resolveFileConfig({ extensions: ['.PNG', ' jpg ', '', 'png'] }).extensions)
      .toEqual(['png', 'jpg']);
  });

  it('tamanho fora do intervalo cai no teto, e não numa promessa que o Storage quebra', () => {
    expect(resolveFileConfig({ maxSizeMb: 0 }).maxSizeMb).toBe(DEFAULT_FILE_MAX_SIZE_MB);
    expect(resolveFileConfig({ maxSizeMb: -1 }).maxSizeMb).toBe(DEFAULT_FILE_MAX_SIZE_MB);
    expect(resolveFileConfig({ maxSizeMb: 999 }).maxSizeMb).toBe(DEFAULT_FILE_MAX_SIZE_MB);
    expect(resolveFileConfig({ maxSizeMb: 3 }).maxSizeMb).toBe(3);
  });

  it('a prévia de imagem é derivada do que o campo aceita', () => {
    expect(fileConfigIsImageOnly({ extensions: ['png', 'JPG'] })).toBe(true);
    expect(fileConfigIsImageOnly({ extensions: ['png', 'pdf'] })).toBe(false);
    expect(fileConfigIsImageOnly({ extensions: [] })).toBe(false);
    expect(fileConfigIsImageOnly()).toBe(false);
  });
});
