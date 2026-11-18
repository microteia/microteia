import { useCallback, useMemo, useState } from 'react';
import { useLabel } from '../../../shared/i18n/useT';
import { useWidgetOwner } from '../../../shared/widgetFilterContext';
import { useWidgetChoiceField } from '../../../shared/widgetChoiceField';
import { useReportPeriodOptions } from '../../../shared/useReportPeriodOptions';
import type { ReportPeriodOption } from '../../../shared/useReportPeriodOptions';
import { isWidgetChoiceFilter, widgetFilterAnswer } from '../../../../domain/schema/ui/widgetSpec';
import type { WidgetFilter } from '../../../../domain/schema/ui/widgetSpec';
import type { CustomFieldValue, FieldDefinition } from '../../../../domain/entities';

export interface WidgetFilterField {
  key: string;
  label: string;
  /** `choice` escolhe do que o escritório tem (`record` / `lookup`), pelo `field`. */
  kind: 'period' | 'text' | 'choice';
  /** A resposta de `period` e `text`. */
  text: string;
  /** As opções de `period`: os `periods` do filtro, ou os nomeados. */
  periodOptions: ReportPeriodOption[];
  /** O campo e a resposta de `choice` — o mesmo controle do filtro do relatório. */
  field?: FieldDefinition;
  value: CustomFieldValue;
}

export interface WidgetFiltersViewModel {
  fields: WidgetFilterField[];
  setValue: (key: string, value: CustomFieldValue) => void;
  /** Só os filtros com estado — tocados ou com padrão —, na forma do relatório. Ver `resolveWidgetAnswers`. */
  values: Readonly<Record<string, unknown>>;
}

/**
 * O padrão do autor na forma do CONTROLE: a escolha de vários é uma lista, a de um é um texto, e os
 * demais são texto. `default: 'active'` numa escolha de vários é a lista com aquela opção.
 */
const initialValue = (filter: WidgetFilter): CustomFieldValue => {
  const value = filter.default;
  if (!isWidgetChoiceFilter(filter)) return typeof value === 'string' ? value : '';
  const chosen = (Array.isArray(value) ? value : [value]).filter((one): one is string => typeof one === 'string');
  return filter.multi === false ? chosen[0] ?? '' : chosen;
};

const initialValues = (filters: WidgetFilter[]): Record<string, CustomFieldValue> =>
  Object.fromEntries(
    filters
      .filter((filter) => filter.default !== undefined)
      .map((filter) => [filter.key, initialValue(filter)]),
  );

const textOf = (value: CustomFieldValue | undefined): string => (typeof value === 'string' ? value : '');

/**
 * A barra de filtros de um painel. Guarda as respostas e as entrega por contexto; quem as usa é o nó
 * que as liga (`bind`). Muda a resposta, cada relatório ligado roda de novo — e só ele.
 */
export const useWidgetFiltersViewModel = (filters: WidgetFilter[]): WidgetFiltersViewModel => {
  const label = useLabel();
  const choiceField = useWidgetChoiceField(useWidgetOwner());
  const declared = useMemo(
    () => (Array.isArray(filters) ? filters : []).filter((filter) => typeof filter?.key === 'string' && filter.key !== ''),
    [filters],
  );
  const [values, setValues] = useState<Record<string, CustomFieldValue>>(() => initialValues(declared));

  const periodOptionsOf = useReportPeriodOptions();

  const fields = useMemo<WidgetFilterField[]>(
    () => declared.flatMap((filter): WidgetFilterField[] => {
      const name = filter.label ? label(filter.label) : filter.key;
      const value = values[filter.key] ?? null;
      if (isWidgetChoiceFilter(filter)) {
        const field = choiceField(filter, name);
        return field ? [{ key: filter.key, label: name, kind: 'choice', text: '', periodOptions: [], field, value }] : [];
      }
      const kind = filter.control === 'period' ? 'period' : 'text';
      const text = textOf(value);
      const periodOptions = kind === 'period' ? periodOptionsOf(filter.periods, text) : [];
      return [{ key: filter.key, label: name, kind, text, periodOptions, value }];
    }),
    [declared, values, label, choiceField, periodOptionsOf],
  );

  const answers = useMemo(
    () => Object.fromEntries(
      declared
        .filter((filter) => Object.prototype.hasOwnProperty.call(values, filter.key))
        .map((filter) => [filter.key, widgetFilterAnswer(filter, values[filter.key])]),
    ),
    [declared, values],
  );

  const setValue = useCallback(
    (key: string, value: CustomFieldValue) => setValues((current) => ({ ...current, [key]: value })),
    [],
  );

  return { fields, setValue, values: answers };
};
