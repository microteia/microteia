import { Timestamp } from 'firebase/firestore';

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

const isTimestampLike = (value: unknown): value is { seconds: number } =>
  !!value && typeof value === 'object' && typeof (value as { seconds?: unknown }).seconds === 'number';

/**
 * Converte para `Date` o que o Firestore devolve num campo de data — e também o que NÃO deveria
 * estar lá.
 *
 * Uma coleção pode ter mais de um escritor (a tela fixa, a tela declarada por extensão, uma
 * automação) e documentos gravados antes de a coerção de tipo existir. Um valor fora do formato não
 * pode derrubar a listagem inteira: a leitura normaliza `Timestamp`, `Date`, texto ISO ou
 * `aaaa-mm-dd` e mapa `{ seconds }`; qualquer outra coisa vira `null`, que toda tela já sabe tratar.
 */
export const toDateValue = (value: unknown): Date | null => {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Timestamp) return value.toDate();
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (isTimestampLike(value)) return new Date(value.seconds * 1000);
  if (typeof value === 'number') return new Date(value);
  if (typeof value === 'string') {
    const dayOnly = DATE_ONLY.exec(value.trim());
    if (dayOnly) return new Date(Number(dayOnly[1]), Number(dayOnly[2]) - 1, Number(dayOnly[3]));
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
};

/** Mesma normalização para os carimbos que a tela assume existir (`createdAt`, `updatedAt`). */
export const toDateValueOrNow = (value: unknown): Date => toDateValue(value) ?? new Date();
