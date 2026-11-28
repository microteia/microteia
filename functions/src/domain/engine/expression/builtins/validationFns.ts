import type { ExpressionFunction } from '../FunctionRegistry';

import { LocalizedError } from '../../../errors/LocalizedError';
// O CNPJ é o MESMO das expressões de campo: uma cópia própria aqui era a que ainda tirava as letras do
// CNPJ alfanumérico (#52) depois de a conta compartilhada já aceitá-lo.
import { isValidCnpj, iso7064Mod97, normalizeCnpj } from '../../../schema/fieldRulePresets';

const isValidCPF = (cpf: string): boolean => {
  const clean = cpf.replace(/\D/g, '');
  if (clean.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(clean)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(clean.charAt(i)) * (10 - i);
  }
  let digit = 11 - (sum % 11);
  if (digit >= 10) digit = 0;
  if (parseInt(clean.charAt(9)) !== digit) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(clean.charAt(i)) * (11 - i);
  }
  digit = 11 - (sum % 11);
  if (digit >= 10) digit = 0;
  return parseInt(clean.charAt(10)) === digit;
};

const isValidEmail = (email: string): boolean => {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
};

export const isCPFFn: ExpressionFunction = {
  name: 'isCPF',
  call: ([value]) => {
    if (typeof value !== 'string') return false;
    return isValidCPF(value);
  },
  description: '@core.automation/expr.isCPF.description',
  signature: 'isCPF(text)',
  example: 'isCPF("123.456.789-10")',
  category: '@core.automation/expr.category.conditional',
  minArgs: 1,
  maxArgs: 1,
};

export const isCNPJFn: ExpressionFunction = {
  name: 'isCNPJ',
  call: ([value]) => {
    if (typeof value !== 'string') return false;
    return isValidCnpj(value);
  },
  description: '@core.automation/expr.isCNPJ.description',
  signature: 'isCNPJ(text)',
  example: 'isCNPJ("12.ABC.345/01DE-35")',
  category: '@core.automation/expr.category.conditional',
  minArgs: 1,
  maxArgs: 1,
};

export const isEmailFn: ExpressionFunction = {
  name: 'isEmail',
  call: ([value]) => {
    if (typeof value !== 'string') return false;
    return isValidEmail(value);
  },
  description: '@core.automation/expr.isEmail.description',
  signature: 'isEmail(text)',
  example: 'isEmail("email@exemplo.com")',
  category: '@core.automation/expr.category.conditional',
  minArgs: 1,
  maxArgs: 1,
};

export const formatCPFFn: ExpressionFunction = {
  name: 'formatCPF',
  call: ([value]) => {
    if (typeof value !== 'string') {
      throw new LocalizedError('@core.automation/expr.arg.string', { fn: 'formatCPF' });
    }
    const clean = value.replace(/\D/g, '');
    if (clean.length !== 11) {
      throw new LocalizedError('@core.automation/expr.arg.cpf-length', { fn: 'formatCPF' });
    }
    return clean.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  },
  description: '@core.automation/expr.formatCPF.description',
  signature: 'formatCPF(text)',
  example: 'formatCPF("12345678910")',
  category: '@core.automation/expr.category.text',
  minArgs: 1,
  maxArgs: 1,
};

export const formatCNPJFn: ExpressionFunction = {
  name: 'formatCNPJ',
  call: ([value]) => {
    if (typeof value !== 'string') {
      throw new LocalizedError('@core.automation/expr.arg.string', { fn: 'formatCNPJ' });
    }
    const clean = normalizeCnpj(value);
    if (!/^[0-9A-Z]{12}\d{2}$/.test(clean)) {
      throw new LocalizedError('@core.automation/expr.arg.cnpj-length', { fn: 'formatCNPJ' });
    }
    return clean.replace(/(.{2})(.{3})(.{3})(.{4})(\d{2})/, '$1.$2.$3/$4-$5');
  },
  description: '@core.automation/expr.formatCNPJ.description',
  signature: 'formatCNPJ(text)',
  example: 'formatCNPJ("12345678000190")',
  category: '@core.automation/expr.category.text',
  minArgs: 1,
  maxArgs: 1,
};

/**
 * O resto ISO 7064 mod 97-10 — a conta é a MESMA da expressão de campo (`schema/fieldRulePresets.ts`,
 * compartilhado). Não-texto é `null`, como texto com caractere fora de 0–9/A–Z: não há o que conferir.
 */
export const mod97Fn: ExpressionFunction = {
  name: 'mod97',
  call: ([value]) => {
    if (typeof value !== 'string') return null;
    return iso7064Mod97(value);
  },
  description: '@core.automation/expr.mod97.description',
  signature: 'mod97(text)',
  example: 'mod97("00000012023805000164") == 1',
  category: '@core.automation/expr.category.math',
  minArgs: 1,
  maxArgs: 1,
};
