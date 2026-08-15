import { describe, expect, it } from 'vitest';
import { applyFormat, checkValue } from './fieldRules';
import type { FieldRulePresetConflict } from './fieldRulePresets';
import {
  applyFormatOps,
  applyMaskTemplate,
  buildFieldRulePresetCatalog,
  maskPlaceholder,
  onlyDigits,
} from './fieldRulePresets';
import {
  BR_FIELD_RULE_PRESETS,
  CEP_TEMPLATE,
  CNPJ_TEMPLATE,
  CPF_TEMPLATE,
  PHONE_TEMPLATES,
} from '../../plugins/marketplace/brasil';

/** Os formatadores do país saíram do kernel: o que resta é o MOTOR, aplicado ao template declarado. */
const formatCpf = (value: string): string => applyMaskTemplate(value, [CPF_TEMPLATE]);
const formatCnpj = (value: string): string => applyMaskTemplate(value, [CNPJ_TEMPLATE]);
const formatPhoneBr = (value: string): string => applyMaskTemplate(value, PHONE_TEMPLATES);
const formatCepBr = (value: string): string => applyMaskTemplate(value, [CEP_TEMPLATE]);

/**
 * Os formatadores que o kernel trazia chumbados, preservados aqui como ORÁCULO: o motor genérico de
 * template só pode substituí-los se produzir exatamente a mesma saída, inclusive para entrada
 * parcial. É este arquivo que autoriza a remoção deles do kernel.
 */
const legacyFormatCpf = (value: string): string => {
  const digits = onlyDigits(value);
  if (digits.length === 0) return '';
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`;
};

const legacyFormatCnpj = (value: string): string => {
  const digits = onlyDigits(value);
  if (digits.length === 0) return '';
  if (digits.length <= 2) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
  if (digits.length <= 12) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12, 14)}`;
};

const legacyFormatPhoneBr = (value: string): string => {
  const digits = onlyDigits(value);
  if (digits.length === 0) return '';
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
};

const legacyFormatCepBr = (value: string): string => {
  const digits = onlyDigits(value);
  if (digits.length === 0) return '';
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5, 8)}`;
};

const legacyCpfCnpj = (value: string): string =>
  onlyDigits(value).length > 11 ? legacyFormatCnpj(value) : legacyFormatCpf(value);

const prefixes = (digits: string): string[] =>
  Array.from({ length: digits.length + 1 }, (_, index) => digits.slice(0, index));

const SAMPLE = '12345678901234567890';

describe('applyMaskTemplate — paridade com os formatadores removidos do kernel', () => {
  it.each([
    ['cpf', formatCpf, legacyFormatCpf],
    ['cnpj', formatCnpj, legacyFormatCnpj],
    ['telefone', formatPhoneBr, legacyFormatPhoneBr],
    ['cep', formatCepBr, legacyFormatCepBr],
  ])('%s produz a mesma saída para toda entrada parcial', (_label, next, legacy) => {
    for (const input of prefixes(SAMPLE)) {
      expect(next(input)).toBe(legacy(input));
    }
  });

  it('telefone alterna entre 10 e 11 dígitos como antes', () => {
    expect(formatPhoneBr('1133334444')).toBe('(11) 3333-4444');
    expect(formatPhoneBr('11933334444')).toBe('(11) 93333-4444');
  });

  it('reformatar um valor já mascarado é idempotente', () => {
    expect(formatCpf('529.982.247-25')).toBe('529.982.247-25');
    expect(formatPhoneBr('(11) 93333-4444')).toBe('(11) 93333-4444');
  });

  it('escolhe entre CPF e CNPJ pelo tamanho, como o preset cpfCnpj fazia', () => {
    for (const input of prefixes(SAMPLE)) {
      expect(applyFormat(input, { preset: 'cpfCnpj' }, buildFieldRulePresetCatalog(BR_FIELD_RULE_PRESETS))).toBe(legacyCpfCnpj(input));
    }
  });

  it('deriva o placeholder do template', () => {
    expect(maskPlaceholder({ templates: ['###.###.###-##'] })).toBe('000.000.000-00');
    expect(maskPlaceholder({ templates: ['#####-###'] })).toBe('00000-000');
  });

  it('aceita classes de letra e alfanumérico', () => {
    expect(applyMaskTemplate('ABC1D23', ['AAA-#A##'])).toBe('ABC-1D23');
    expect(applyMaskTemplate('AB12CD', ['**-**-**'])).toBe('AB-12-CD');
  });

  it('devolve o valor cru quando não há template utilizável', () => {
    expect(applyMaskTemplate('qualquer', [])).toBe('qualquer');
  });
});

describe('presets do núcleo aplicados por chave', () => {
  it.each([
    ['digits', 'a1b2c3', '123'],
    ['upper', 'ana', 'ANA'],
    ['lower', 'ANA', 'ana'],
    ['trim', '  ana  ', 'ana'],
  ])('%s formata como antes', (preset, input, expected) => {
    expect(applyFormat(input, { preset })).toBe(expected);
  });

  /** Documento e telefone são regra de PAÍS: sem a extensão do Brasil, a chave não existe. */
  it('o núcleo não conhece CPF, CNPJ, telefone nem CEP', () => {
    expect(applyFormat('52998224725', { preset: 'cpf' })).toBe('52998224725');
    expect(checkValue('111.111.111-11', { check: 'cpf' }, 'Documento')).toBeUndefined();
  });
});

/**
 * Os mesmos formatos de sempre, agora vindos da extensão do Brasil — é o catálogo que o escritório
 * enxerga depois de instalá-la, e o que prova que a saída não mudou ao sair do kernel.
 */
describe('presets do Brasil, declarados por extensão', () => {
  const catalog = buildFieldRulePresetCatalog(BR_FIELD_RULE_PRESETS);

  it.each([
    ['cpf', '52998224725', '529.982.247-25'],
    ['cnpj', '11222333000181', '11.222.333/0001-81'],
    ['phone', '11933334444', '(11) 93333-4444'],
    ['cep', '01310100', '01310-100'],
  ])('%s formata como antes', (preset, input, expected) => {
    expect(applyFormat(input, { preset }, catalog)).toBe(expected);
  });

  it.each([
    ['cpf', '529.982.247-25', '111.111.111-11'],
    ['cnpj', '11.222.333/0001-81', '11.222.333/0001-99'],
    ['cpfCnpj', '52998224725', '52998224720'],
  ])('%s valida pelo dígito verificador', (check, valid, invalid) => {
    expect(checkValue(valid, { check }, 'Documento', catalog)).toBeUndefined();
    expect(checkValue(invalid, { check }, 'Documento', catalog)).toBeDefined();
  });
});

describe('tolerância a declaração ausente ou quebrada', () => {
  it('preset desconhecido não altera o valor nem reprova', () => {
    expect(applyFormat('  Ana  ', { preset: 'com.acme/inexistente' })).toBe('  Ana  ');
    expect(checkValue('Ana', { check: 'com.acme/inexistente' }, 'Nome')).toBeUndefined();
  });

  it('expressão quebrada aprova o valor em vez de bloquear a gravação', () => {
    const catalog = buildFieldRulePresetCatalog([
      { key: 'x/quebrado', label: 'Quebrado', validate: { expression: 'isCPF(' } },
    ]);
    expect(checkValue('qualquer', { check: 'x/quebrado' }, 'Campo', catalog)).toBeUndefined();
  });

  it('regex inválida dentro de um preset é no-op', () => {
    const catalog = buildFieldRulePresetCatalog([
      { key: 'x/regex', label: 'Regex', format: [{ op: 'regex', pattern: '([', replacement: 'z' }] },
    ]);
    expect(applyFormat('abc', { preset: 'x/regex' }, catalog)).toBe('abc');
  });
});

describe('catálogo declarado', () => {
  it('não deixa uma extensão redefinir uma chave do núcleo', () => {
    const conflicts: FieldRulePresetConflict[] = [];
    const catalog = buildFieldRulePresetCatalog(
      [{ key: 'digits', label: 'Dígitos sequestrados', format: [{ op: 'upper' }] }],
      conflicts,
    );
    // O rótulo do preset do núcleo é uma REFERÊNCIA; o ponto de render é que a resolve.
    expect(catalog.get('digits')?.label).toBe('@core.ui/preset.digits');
    expect(conflicts.map((conflict) => conflict.key)).toEqual(['digits']);
  });

  it('resolve um preset declarado por extensão', () => {
    const catalog = buildFieldRulePresetCatalog([
      {
        key: 'com.acme.docs/rg-sp',
        label: 'RG de São Paulo',
        mask: { templates: ['##.###.###-#'] },
        format: [{ op: 'digits' }, { op: 'mask', templates: ['##.###.###-#'] }],
        validate: { pattern: '^\\d{2}\\.\\d{3}\\.\\d{3}-\\d$', message: 'RG inválido' },
      },
    ]);
    expect(applyFormat('123456789', { preset: 'com.acme.docs/rg-sp' }, catalog)).toBe('12.345.678-9');
    expect(checkValue('12.345.678-9', { check: 'com.acme.docs/rg-sp' }, 'RG', catalog)).toBeUndefined();
    expect(checkValue('12345', { check: 'com.acme.docs/rg-sp' }, 'RG', catalog)).toEqual({ error: 'RG inválido' });
  });

  it('encadeia ops na ordem declarada', () => {
    expect(applyFormatOps('  ana maria  ', [{ op: 'trim' }, { op: 'upper' }])).toBe('ANA MARIA');
    expect(applyFormatOps('ana', [{ op: 'upper' }, { op: 'lower' }])).toBe('ana');
  });
});
