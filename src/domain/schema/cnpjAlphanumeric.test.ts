import { describe, expect, it } from 'vitest';
import {
  applyFormatOps,
  applyMaskTemplate,
  CORE_FIELD_RULE_PRESET_CATALOG,
  isValidCnpj,
} from './fieldRulePresets';
import { evaluateFieldExpression } from './fieldExpression';
import { BR_FIELD_RULE_PRESETS, CNPJ_TEMPLATE, CPF_TEMPLATE } from '../../plugins/marketplace/brasil';

/**
 * Issue #52: o CNPJ alfanumérico (IN RFB 2.229/2024, letras A–Z nas 12 primeiras posições) era recusado
 * em todo lugar — `isValidCnpj` tirava as letras antes da conta, a máscara só aceitava dígito e a
 * normalização `digits` da chave o encurtava. O exemplo é o da norma: base 12ABC34501DE, dígitos 35.
 */
const ALPHANUMERIC = '12ABC34501DE35';
const EMPTY = { value: null, data: {} };
const NUMERIC = '11222333000181';
const presetOf = (key: string) => {
  const preset = BR_FIELD_RULE_PRESETS.find((candidate) => candidate.key === key);
  if (!preset) throw new Error(`preset ${key} não existe`);
  return preset;
};

describe('dígito verificador do CNPJ alfanumérico (#52)', () => {
  it('aceita o alfanumérico válido, cru, formatado ou em minúsculas', () => {
    expect(isValidCnpj(ALPHANUMERIC)).toBe(true);
    expect(isValidCnpj('12.ABC.345/01DE-35')).toBe(true);
    expect(isValidCnpj('12.abc.345/01de-35')).toBe(true);
  });

  it('recusa o dígito errado e a letra nas posições do dígito', () => {
    expect(isValidCnpj('12ABC34501DE36')).toBe(false);
    expect(isValidCnpj('12ABC34501DE3A')).toBe(false);
    expect(isValidCnpj('12ABC34501D')).toBe(false);
  });

  it('o CNPJ numérico continua valendo como antes, e a sequência repetida continua recusada', () => {
    expect(isValidCnpj(NUMERIC)).toBe(true);
    expect(isValidCnpj('11.222.333/0001-81')).toBe(true);
    expect(isValidCnpj('11222333000182')).toBe(false);
    expect(isValidCnpj('00000000000000')).toBe(false);
  });

  it('as funções de expressão `isCNPJ` e `formatCNPJ` seguem a mesma conta', () => {
    expect(evaluateFieldExpression(`isCNPJ("${ALPHANUMERIC}")`, EMPTY)).toBe(true);
    expect(evaluateFieldExpression(`formatCNPJ("${ALPHANUMERIC.toLowerCase()}")`, EMPTY)).toBe('12.ABC.345/01DE-35');
    expect(evaluateFieldExpression(`formatCNPJ("${NUMERIC}")`, EMPTY)).toBe('11.222.333/0001-81');
  });
});

describe('máscara: a letra digitada não é engolida (#52)', () => {
  it('a máscara de CNPJ deixa letra nas 12 primeiras posições', () => {
    expect(applyMaskTemplate('12ABC34501DE35', [CNPJ_TEMPLATE])).toBe('12.ABC.345/01DE-35');
    expect(applyMaskTemplate(NUMERIC, [CNPJ_TEMPLATE])).toBe('11.222.333/0001-81');
  });

  it('CPF ou CNPJ: a letra leva ao template do CNPJ já no meio da digitação', () => {
    const templates = [CPF_TEMPLATE, CNPJ_TEMPLATE];
    expect(applyMaskTemplate('12A', templates)).toBe('12.A');
    expect(applyMaskTemplate('12ABC345', templates)).toBe('12.ABC.345');
    expect(applyMaskTemplate('12345678909', templates)).toBe('123.456.789-09');
    expect(applyMaskTemplate(NUMERIC, templates)).toBe('11.222.333/0001-81');
  });

  it('o que fica GRAVADO pelos presets cnpj e cpfCnpj guarda as letras, em maiúsculas', () => {
    expect(applyFormatOps('12.abc.345/01de-35', presetOf('cnpj').format)).toBe('12.ABC.345/01DE-35');
    expect(applyFormatOps('12abc34501de35', presetOf('cpfCnpj').format)).toBe('12.ABC.345/01DE-35');
    expect(applyFormatOps('123.456.789-09', presetOf('cpfCnpj').format)).toBe('123.456.789-09');
  });
});

describe('normalização de chave sem perder letra (#52)', () => {
  it('o preset do núcleo `alphanumeric` mantém letras e dígitos, em maiúsculas', () => {
    const format = CORE_FIELD_RULE_PRESET_CATALOG.get('alphanumeric')?.format;
    expect(applyFormatOps('12.abc.345/01de-35', format)).toBe('12ABC34501DE35');
  });

  it('dois CNPJs que diferem só nas letras não colidem — o que `digits` fazia', () => {
    const format = CORE_FIELD_RULE_PRESET_CATALOG.get('alphanumeric')?.format;
    const digits = CORE_FIELD_RULE_PRESET_CATALOG.get('digits')?.format;
    expect(applyFormatOps('12ABC34501DE35', digits)).toBe(applyFormatOps('12XYZ34501QR35', digits));
    expect(applyFormatOps('12ABC34501DE35', format)).not.toBe(applyFormatOps('12XYZ34501QR35', format));
  });
});
