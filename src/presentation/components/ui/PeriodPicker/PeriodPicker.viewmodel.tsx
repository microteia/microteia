import { useCallback, useMemo, useState } from 'react';
import { useT } from '../../../shared/i18n/useT';
import type { ReportPeriodOption } from '../../../shared/useReportPeriodOptions';
import {
  formatRelativeReportPeriod,
  parseRelativeReportPeriod,
  REPORT_PERIOD_MAX_COUNT,
  REPORT_PERIOD_UNITS,
} from '../../../../domain/schema/report/reportPeriod';
import type { ReportPeriodUnit } from '../../../../domain/schema/report/reportPeriod';

export interface PeriodPickerProps {
  options: ReportPeriodOption[];
  value: string;
  onChange: (value: string) => void;
  label?: string;
  /**
   * Oferece "Personalizado" — um número e uma unidade que viram `last-<n>-<unit>`. Ligado por padrão: é
   * o que deixa o LEITOR pedir uma janela que o autor não listou (#4). O editor o desliga quando o filtro
   * declara `periods`, porque ali o padrão tem de ser um dos oferecidos.
   */
  allowCustom?: boolean;
}

export interface PeriodPickerViewModel {
  label?: string;
  options: ReportPeriodOption[];
  selected: string;
  select: (value: string) => void;
  editing: boolean;
  count: string;
  setCount: (value: string) => void;
  unit: ReportPeriodUnit;
  unitOptions: { value: string; label: string }[];
  setUnit: (value: string) => void;
  includeCurrent: boolean;
  setIncludeCurrent: (value: boolean) => void;
  max: number;
  error: string | null;
  apply: () => void;
  cancel: () => void;
  labels: { count: string; unit: string; includeCurrent: string; apply: string; cancel: string };
}

/** Valor de opção, nunca texto: a escolha que abre o editor em vez de responder o filtro. */
const CUSTOM = '__custom__';

const isUnit = (value: string): value is ReportPeriodUnit =>
  (REPORT_PERIOD_UNITS as readonly string[]).includes(value);

export const usePeriodPickerViewModel = ({
  options,
  value,
  onChange,
  label,
  allowCustom = true,
}: PeriodPickerProps): PeriodPickerViewModel => {
  const t = useT('core.reports');
  const ui = useT('core.ui');
  const [editing, setEditing] = useState(false);
  const [count, setCount] = useState('12');
  const [unit, setUnitState] = useState<ReportPeriodUnit>('months');
  const [includeCurrent, setIncludeCurrent] = useState(true);

  const shown = useMemo(
    () => (allowCustom ? [...options, { value: CUSTOM, label: t('period.custom') }] : options),
    [allowCustom, options, t],
  );

  const unitOptions = useMemo(
    () => REPORT_PERIOD_UNITS.map((one) => ({ value: one, label: t(`period.unit.${one}`) })),
    [t],
  );

  // O editor abre com a janela ATUAL quando ela é parametrizada: ajustar "12 meses" para 24 não pode
  // exigir digitar tudo de novo.
  const select = useCallback((next: string) => {
    if (next !== CUSTOM) {
      setEditing(false);
      onChange(next);
      return;
    }
    const current = parseRelativeReportPeriod(value);
    if (current && current.offset === 0) {
      setCount(String(current.count));
      setUnitState(current.unit);
      setIncludeCurrent(current.direction === 'last');
    }
    setEditing(true);
  }, [onChange, value]);

  const setUnit = useCallback((next: string) => {
    if (isUnit(next)) setUnitState(next);
  }, []);

  const max = REPORT_PERIOD_MAX_COUNT[unit];
  const amount = Number(count);
  const valid = Number.isInteger(amount) && amount >= 1 && amount <= max;

  const apply = useCallback(() => {
    if (!valid) return;
    const token = formatRelativeReportPeriod({
      direction: includeCurrent ? 'last' : 'previous',
      count: amount,
      unit,
      offset: 0,
    });
    setEditing(false);
    onChange(token);
  }, [valid, includeCurrent, amount, unit, onChange]);

  const cancel = useCallback(() => setEditing(false), []);

  return {
    label,
    options: shown,
    selected: editing ? CUSTOM : value,
    select,
    editing,
    count,
    setCount,
    unit,
    unitOptions,
    setUnit,
    includeCurrent,
    setIncludeCurrent,
    max,
    error: editing && count.trim() !== '' && !valid ? t('period.custom.range', { max }) : null,
    apply,
    cancel,
    labels: {
      count: t('period.custom.count'),
      unit: t('period.custom.unit'),
      includeCurrent: t('period.custom.include-current'),
      apply: ui('action.apply'),
      cancel: ui('action.cancel'),
    },
  };
};
