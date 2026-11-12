// ═══════════════════════════════════════════════════════════════════════════
// ⚠️  ARQUIVO GERADO POR scripts/sync-schemas.cjs — NÃO EDITE.
// Fonte única: src/domain/schema/report/reportBuckets.ts
// Para alterar, edite a fonte e rode: npm run sync-schemas
// ═══════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════════
// FONTE ÚNICA — a cópia em functions/src/domain/schema/report/reportBuckets.ts é
// GERADA por scripts/sync-schemas.cjs (npm run sync-schemas). Nunca edite a cópia.
// ═══════════════════════════════════════════════════════════════════════════════

import type { ReportBucket, ReportGranularity } from './reportSpec';

/** Uma data CIVIL — ano, mês e dia, sem instante e sem fuso. É sobre ela que o balde é cortado. */
interface CivilDate {
  year: number;
  month: number;
  day: number;
}

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

const pad = (value: number, size: number): string => String(value).padStart(size, '0');

/**
 * O ano, mês e dia que o valor tem NAQUELE FUSO.
 *
 * Um texto `AAAA-MM-DD` é lido ao pé da letra, sem conversão nenhuma: ele já É uma data civil, e
 * convertê-lo de fuso é como o dia 1º vira dia 31 do mês anterior — o defeito clássico, que aparece
 * como um mês inteiro de faturamento no balde errado. Um INSTANTE, sim, é convertido: é o que faz
 * uma venda das 21h de 31/03 em São Paulo contar em março, e não em abril.
 */
const civilDateOf = (value: unknown, timeZone: string | undefined): CivilDate | null => {
  if (typeof value === 'string') {
    const literal = DATE_ONLY.exec(value.trim());
    if (literal) {
      return { year: Number(literal[1]), month: Number(literal[2]), day: Number(literal[3]) };
    }
  }

  const instant = value instanceof Date
    ? value
    : (typeof value === 'number' || typeof value === 'string' ? new Date(value) : null);
  if (!instant || Number.isNaN(instant.getTime())) return null;

  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timeZone || 'UTC',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(instant);

    const read = (type: string): number =>
      Number(parts.find((part) => part.type === type)?.value ?? Number.NaN);

    const civil = { year: read('year'), month: read('month'), day: read('day') };
    return Number.isNaN(civil.year) || Number.isNaN(civil.month) || Number.isNaN(civil.day)
      ? null
      : civil;
  } catch {
    // Fuso inválido não pode derrubar o relatório: cai em UTC, que é o padrão declarado.
    return {
      year: instant.getUTCFullYear(),
      month: instant.getUTCMonth() + 1,
      day: instant.getUTCDate(),
    };
  }
};

/** A semana ISO da data civil — segunda a domingo, e a semana 1 é a que contém a primeira quinta. */
const isoWeekOf = (civil: CivilDate): { year: number; week: number } => {
  const date = new Date(Date.UTC(civil.year, civil.month - 1, civil.day));
  const weekday = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - weekday);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return { year: date.getUTCFullYear(), week };
};

/**
 * A CHAVE do balde: ordenável como texto, e legível sem tradução.
 *
 * `2026-03` ordena cronologicamente na comparação de strings, que é o que permite ordenar os grupos
 * sem carregar a data junto. Valor que não é data devolve `null` — quem chama trata como valor cru,
 * nunca como um balde inventado.
 */
export const bucketDateValue = (
  value: unknown,
  granularity: ReportGranularity,
  timeZone?: string,
): string | null => {
  // Uma lista de datas — o que um caminho colhe de uma referência de VÁRIOS — tem um balde por item,
  // e a chave é a composição deles, do mesmo jeito que o agrupamento já compõe a chave de uma lista
  // de valores crus. Sem isto, o balde não se aplicava e o agrupamento caía no valor cru: a data
  // inteira onde se pediu o mês, sem uma palavra na tela dizendo que o corte foi ignorado.
  if (Array.isArray(value)) {
    const buckets = value.map((item) => bucketDateValue(item, granularity, timeZone));
    return buckets.length > 0 && buckets.every((one) => one !== null) ? buckets.join(',') : null;
  }

  const civil = civilDateOf(value, timeZone);
  if (!civil) return null;

  switch (granularity) {
    case 'day':
      return `${pad(civil.year, 4)}-${pad(civil.month, 2)}-${pad(civil.day, 2)}`;
    case 'week': {
      const { year, week } = isoWeekOf(civil);
      return `${pad(year, 4)}-W${pad(week, 2)}`;
    }
    case 'month':
      return `${pad(civil.year, 4)}-${pad(civil.month, 2)}`;
    case 'quarter':
      return `${pad(civil.year, 4)}-Q${Math.floor((civil.month - 1) / 3) + 1}`;
    case 'year':
      return `${pad(civil.year, 4)}`;
    default:
      return null;
  }
};

const numericOf = (value: unknown): number | null => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

/**
 * A faixa do valor: a primeira cujo `lt` ele não alcança, ou a do resto (sem `lt`).
 *
 * O que não é número não cai em faixa nenhuma — e vira o grupo VAZIO, nunca a primeira faixa: um
 * registro sem vencimento contado como "0–30 dias" seria a pior leitura de um aging.
 */
export const reportBucketOf = (buckets: readonly ReportBucket[], value: unknown): ReportBucket | null => {
  const number = numericOf(value);
  if (number === null) return null;
  return buckets.find((bucket) => typeof bucket.lt === 'number' && number < bucket.lt)
    ?? buckets.find((bucket) => typeof bucket.lt !== 'number')
    ?? null;
};
