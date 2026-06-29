import { onlyNumbers } from './formatters';

/**
 * Valida CPF usando o algoritmo oficial
 */
export const validateCPF = (value: string): boolean => {
  const cpf = onlyNumbers(value);
  
  if (cpf.length !== 11) return false;
  
  // Rejeita CPFs com todos os dígitos iguais
  if (/^(\d)\1{10}$/.test(cpf)) return false;
  
  // Valida primeiro dígito verificador
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(cpf.charAt(i)) * (10 - i);
  }
  let digit = 11 - (sum % 11);
  if (digit >= 10) digit = 0;
  if (digit !== parseInt(cpf.charAt(9))) return false;
  
  // Valida segundo dígito verificador
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(cpf.charAt(i)) * (11 - i);
  }
  digit = 11 - (sum % 11);
  if (digit >= 10) digit = 0;
  if (digit !== parseInt(cpf.charAt(10))) return false;
  
  return true;
};

/**
 * Valida CNPJ usando o algoritmo oficial
 */
export const validateCNPJ = (value: string): boolean => {
  const cnpj = onlyNumbers(value);
  
  if (cnpj.length !== 14) return false;
  
  // Rejeita CNPJs com todos os dígitos iguais
  if (/^(\d)\1{13}$/.test(cnpj)) return false;
  
  // Valida primeiro dígito verificador
  let sum = 0;
  let weight = 5;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(cnpj.charAt(i)) * weight;
    weight = weight === 2 ? 9 : weight - 1;
  }
  let digit = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (digit !== parseInt(cnpj.charAt(12))) return false;
  
  // Valida segundo dígito verificador
  sum = 0;
  weight = 6;
  for (let i = 0; i < 13; i++) {
    sum += parseInt(cnpj.charAt(i)) * weight;
    weight = weight === 2 ? 9 : weight - 1;
  }
  digit = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (digit !== parseInt(cnpj.charAt(13))) return false;
  
  return true;
};

/**
 * Valida se o telefone tem tamanho adequado (10 ou 11 dígitos)
 */
export const validatePhone = (value: string): boolean => {
  const numbers = onlyNumbers(value);
  return numbers.length === 10 || numbers.length === 11;
};

/**
 * Valida se o CEP tem 8 dígitos
 */
export const validateCEP = (value: string): boolean => {
  const numbers = onlyNumbers(value);
  return numbers.length === 8;
};
