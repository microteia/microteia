import type { ExpressionFunction } from '../FunctionRegistry';

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

const isValidCNPJ = (cnpj: string): boolean => {
  const clean = cnpj.replace(/\D/g, '');
  if (clean.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(clean)) return false;

  let sum = 0;
  let multiplier = 5;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(clean.charAt(i)) * multiplier;
    multiplier = multiplier === 2 ? 9 : multiplier - 1;
  }
  let digit = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (parseInt(clean.charAt(12)) !== digit) return false;

  sum = 0;
  multiplier = 6;
  for (let i = 0; i < 13; i++) {
    sum += parseInt(clean.charAt(i)) * multiplier;
    multiplier = multiplier === 2 ? 9 : multiplier - 1;
  }
  digit = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  return parseInt(clean.charAt(13)) === digit;
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
  description: 'Valida se um texto é um CPF válido',
  signature: 'isCPF(texto)',
  example: 'isCPF("123.456.789-10")',
  category: 'Condicional',
  minArgs: 1,
  maxArgs: 1,
};

export const isCNPJFn: ExpressionFunction = {
  name: 'isCNPJ',
  call: ([value]) => {
    if (typeof value !== 'string') return false;
    return isValidCNPJ(value);
  },
  description: 'Valida se um texto é um CNPJ válido',
  signature: 'isCNPJ(texto)',
  example: 'isCNPJ("12.345.678/0001-90")',
  category: 'Condicional',
  minArgs: 1,
  maxArgs: 1,
};

export const isEmailFn: ExpressionFunction = {
  name: 'isEmail',
  call: ([value]) => {
    if (typeof value !== 'string') return false;
    return isValidEmail(value);
  },
  description: 'Valida se um texto é um e-mail válido',
  signature: 'isEmail(texto)',
  example: 'isEmail("email@exemplo.com")',
  category: 'Condicional',
  minArgs: 1,
  maxArgs: 1,
};

export const formatCPFFn: ExpressionFunction = {
  name: 'formatCPF',
  call: ([value]) => {
    if (typeof value !== 'string') {
      throw new Error('formatCPF: argumento deve ser uma string');
    }
    const clean = value.replace(/\D/g, '');
    if (clean.length !== 11) {
      throw new Error('formatCPF: CPF deve ter 11 dígitos');
    }
    return clean.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  },
  description: 'Formata um CPF no padrão XXX.XXX.XXX-XX',
  signature: 'formatCPF(texto)',
  example: 'formatCPF("12345678910")',
  category: 'Texto',
  minArgs: 1,
  maxArgs: 1,
};

export const formatCNPJFn: ExpressionFunction = {
  name: 'formatCNPJ',
  call: ([value]) => {
    if (typeof value !== 'string') {
      throw new Error('formatCNPJ: argumento deve ser uma string');
    }
    const clean = value.replace(/\D/g, '');
    if (clean.length !== 14) {
      throw new Error('formatCNPJ: CNPJ deve ter 14 dígitos');
    }
    return clean.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  },
  description: 'Formata um CNPJ no padrão XX.XXX.XXX/XXXX-XX',
  signature: 'formatCNPJ(texto)',
  example: 'formatCNPJ("12345678000190")',
  category: 'Texto',
  minArgs: 1,
  maxArgs: 1,
};
