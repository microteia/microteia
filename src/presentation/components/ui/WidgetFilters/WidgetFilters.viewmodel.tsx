import { useCallback, useMemo, useState } from 'react';
import { useLabel, useT } from '../../../shared/i18n/useT';
import { REPORT_PERIODS } from '../../../../domain/schema/report/reportPeriod';
import type { WidgetFilter } from '../../../../domain/schema/ui/widgetSpec';

export interface WidgetFilterField {
  key: string;
  label: string;
  isPeriod: boolean;
  value: string;
}

export interface WidgetFiltersViewModel {
  fields: WidgetFilterField[];
  periodOptions: { value: string; label: string }[];
  setValue: (key: string, value: string) => void;
  /** Só os filtros com estado: tocados ou com padrão. Ver `resolveWidgetAnswers`. */
  values: Readonly<Record<string, string>>;
}

const initialValues = (filters: WidgetFilter[]): Record<string, string> =>
  Object.fromEntries(
    filters
      .filter((filter) => typeof filter.default === 'string')
      .map((filter) => [filter.key, filter.default as string]),
  );

/**
 * A barra de filtros de um painel. Guarda as respostas e as entrega por contexto; quem as usa é o nó
 * que as liga (`bind`). Muda a resposta, cada relatório ligado roda de novo — e só ele.
 */
export const useWidgetFiltersViewModel = (filters: WidgetFilter[]): WidgetFiltersViewModel => {
  const t = useT('core.reports');
  const label = useLabel();
  const declared = useMemo(
    () => (Array.isArray(filters) ? filters : []).filter((filter) => typeof filter?.key === 'string' && filter.key !== ''),
    [filters],
  );
  const [values, setValues] = useState<Record<string, string>>(() => initialValues(declared));

  const periodOptions = useMemo(
    () => [
      { value: '', label: t('period.any') },
      ...REPORT_PERIODS.map((period) => ({ value: period, label: t(`period.${period}`) })),
    ],
    [t],
  );

  const fields = useMemo<WidgetFilterField[]>(
    () => declared.map((filter) => ({
      key: filter.key,
      label: filter.label ? label(filter.label) : filter.key,
      isPeriod: filter.control === 'period',
      value: values[filter.key] ?? '',
    })),
    [declared, values, label],
  );

  const setValue = useCallback(
    (key: string, value: string) => setValues((current) => ({ ...current, [key]: value })),
    [],
  );

  return { fields, periodOptions, setValue, values };
};
