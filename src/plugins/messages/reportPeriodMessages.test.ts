import { describe, expect, it } from 'vitest';
import { CORE_REPORTS_MESSAGES } from './coreReports';
import { CORE_REPORTS } from '../marketplace/localePtBr/coreReports';
import {
  REPORT_PERIOD_DIRECTIONS,
  REPORT_PERIOD_UNITS,
  REPORT_PERIODS,
  reportPeriodLabel,
} from '../../domain/schema/report/reportPeriod';

/**
 * A chave do nome de um período é MONTADA (`reportPeriodLabel`), e o `verify-messages` só confere a
 * literal. Sem isto, uma unidade nova entrava na gramática e aparecia no seletor como a própria chave.
 */
const keysOf = (period: string): string[] => {
  const name = reportPeriodLabel(period);
  if (!name) return [];
  return name.params ? [`${name.key}.one`, `${name.key}.other`] : [name.key];
};

const everyPeriod = [
  ...REPORT_PERIODS,
  ...REPORT_PERIOD_DIRECTIONS.flatMap((direction) => REPORT_PERIOD_UNITS.map((unit) => `${direction}-2-${unit}`)),
];

describe('o nome de todo período existe nos dois catálogos', () => {
  it.each(everyPeriod)('%s', (period) => {
    const keys = keysOf(period);
    expect(keys.length).toBeGreaterThan(0);
    for (const key of keys) {
      expect(CORE_REPORTS_MESSAGES[key], `en: ${key}`).toBeTypeOf('string');
      expect(CORE_REPORTS[key], `pt-BR: ${key}`).toBeTypeOf('string');
    }
  });
});
