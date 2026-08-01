import { onlyDigits } from '../domain/schema/fieldRules';

export const onlyNumbers = onlyDigits;

const brlFormatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

/**
 * Formata um valor numérico como moeda BRL: R$ 1.234,56
 */
export const formatCurrencyBRL = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return '';
  return brlFormatter.format(value);
};

/**
 * Converte os dígitos digitados por último em um input de moeda (interpretados
 * como centavos, da direita para a esquerda) no valor numérico correspondente.
 */
export const parseCurrencyDigits = (raw: string): number | null => {
  const digits = onlyDigits(raw);
  if (digits.length === 0) return null;
  return Number(digits) / 100;
};

/**
 * Converte um Date para o formato aaaa-mm-dd de um <input type="date">,
 * usando os componentes de data locais (nunca toISOString, que desloca
 * o dia em fusos com offset negativo, ex: horário de Brasília à noite).
 */
/**
 * Uma data no formato que o escritório lê. Aceita `Date`, string ISO ou Timestamp já convertido —
 * a mesma coleção tem documentos de épocas diferentes, e quem exibe não deve precisar se defender
 * disso. Valor irreconhecível vira string vazia, nunca "Invalid Date".
 */
export const formatDate = (value: unknown): string => {
  if (value === null || value === undefined || value === '') return '';
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('pt-BR');
};

export const toDateInputValue = (d: Date | null | undefined): string => {
  if (!d) return '';
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};
