import { isValidCnpj, isValidCpf, onlyDigits } from '../domain/schema/fieldRules';

export const validateCPF = isValidCpf;

export const validateCNPJ = isValidCnpj;

/**
 * Valida se o telefone tem tamanho adequado (10 ou 11 dígitos)
 */
export const validatePhone = (value: string): boolean => {
  const numbers = onlyDigits(value);
  return numbers.length === 10 || numbers.length === 11;
};

/**
 * Valida se o CEP tem 8 dígitos
 */
export const validateCEP = (value: string): boolean => {
  const numbers = onlyDigits(value);
  return numbers.length === 8;
};
