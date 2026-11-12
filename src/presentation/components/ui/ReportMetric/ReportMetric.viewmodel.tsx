import { useEffect, useState } from 'react';
import { useLabel, useLocaleFormat, useT } from '../../../shared/i18n/useT';
import { useReportDefinitions } from '../../../../stores/useReportDefinitions';
import { useWidgetFilterValues } from '../../../shared/widgetFilterContext';
import { formatMeasureValue } from '../../../shared/report/reportFormatting';
import { isAggregateMeasure } from '../../../../domain/schema/report/reportSpec';
import { previousReportPeriod, REPORT_PROMPT_PERIOD_CONTROL } from '../../../../domain/schema/report/reportPeriod';
import { resolveWidgetAnswers } from '../../../../domain/schema/ui/widgetSpec';
import type { WidgetReportAnswers } from '../../../../domain/schema/ui/widgetSpec';

export interface ReportMetricProps extends WidgetReportAnswers {
  reportKey: string;
  label: string;
  measure?: string;
  compare?: 'previous-period';
}

export type ReportMetricTrend = 'up' | 'down' | 'flat';

export interface ReportMetricViewModel {
  label: string;
  value: string;
  isLoading: boolean;
  /** A variação contra o período anterior, já escrita — ausente quando não há com o que comparar. */
  delta: string | null;
  trend: ReportMetricTrend;
  /** REFERÊNCIA resolvida do que impediu o número. */
  error: string | null;
}

interface MetricState {
  current: number | null;
  previous: number | null;
  error: string | null;
  loading: boolean;
}

/**
 * Um indicador: o TOTAL de uma medida de um relatório do catálogo, pelo mesmo caminho do relatório —
 * mesma permissão, mesmos filtros, mesma visibilidade por registro.
 *
 * A comparação roda o relatório uma segunda vez, com o filtro de período trocado pelo anterior
 * (`previousReportPeriod`). Sem filtro de período, ou com um período que não tem anterior nomeado
 * ("últimos 30 dias"), não há variação a mostrar — e o indicador mostra só o número, em vez de
 * comparar com uma janela que ninguém declarou.
 */
export const useReportMetricViewModel = ({
  reportKey, label: caption, measure, compare, prompts, bind,
}: ReportMetricProps): ReportMetricViewModel => {
  const t = useT('core.reports');
  const label = useLabel();
  const formatters = useLocaleFormat();
  const { getReport, runReport } = useReportDefinitions();
  const filterValues = useWidgetFilterValues();

  const report = getReport(reportKey);
  const spec = report?.spec;
  const measureKey = measure
    ?? (spec?.dataset.measures ?? []).find(isAggregateMeasure)?.key
    ?? spec?.dataset.measures?.[0]?.key
    ?? '';
  const format = (spec?.dataset.measures ?? []).find((one) => one.key === measureKey)?.format;

  // Por TEXTO, e não por objeto: as respostas são remontadas a cada render, e o efeito abaixo rodaria o
  // relatório de novo a cada um.
  const answersKey = JSON.stringify(resolveWidgetAnswers({ prompts, bind }, filterValues));

  // Uma STRING, e não um objeto: é dependência do efeito, e o valor igual não roda o relatório de novo.
  const previousAnswersKey = ((): string | null => {
    if (compare !== 'previous-period' || !report) return null;
    const answers = JSON.parse(answersKey) as Record<string, unknown>;
    const period = (report.spec.presentation?.prompts ?? [])
      .find((prompt) => prompt.control === REPORT_PROMPT_PERIOD_CONTROL);
    if (!period) return null;
    const current = Object.prototype.hasOwnProperty.call(answers, period.key)
      ? answers[period.key]
      : (period.default?.kind === 'Literal' ? period.default.value : undefined);
    const previous = previousReportPeriod(current);
    return previous ? JSON.stringify({ ...answers, [period.key]: previous }) : null;
  })();

  const [state, setState] = useState<MetricState>({ current: null, previous: null, error: null, loading: true });

  useEffect(() => {
    if (!report) return undefined;
    let active = true;
    const totalOf = async (key: string): Promise<number | null> => {
      const outcome = await runReport({ reportId: report.id, prompts: JSON.parse(key) as Record<string, unknown> });
      if (outcome.error) throw new Error(label(outcome.error, outcome.errorParams));
      return outcome.result?.totals?.values[measureKey] ?? null;
    };
    // eslint-disable-next-line react-hooks/set-state-in-effect -- estado de carga antes da chamada
    setState((current) => ({ ...current, loading: true, error: null }));
    void Promise.all([totalOf(answersKey), previousAnswersKey ? totalOf(previousAnswersKey) : Promise.resolve(null)])
      .then(([current, previous]) => {
        if (active) setState({ current, previous, error: null, loading: false });
      })
      .catch((caught: unknown) => {
        if (active) {
          setState({ current: null, previous: null, loading: false, error: caught instanceof Error ? label(caught.message) : String(caught) });
        }
      });
    return () => { active = false; };
  }, [report, runReport, answersKey, previousAnswersKey, measureKey, label]);

  const variation = state.current !== null && state.previous !== null && state.previous !== 0
    ? (state.current - state.previous) / Math.abs(state.previous)
    : null;

  return {
    label: label(caption),
    value: report ? formatMeasureValue(state.current, format, formatters) : '—',
    isLoading: state.loading && report !== undefined,
    delta: variation === null
      ? null
      : t('metric.compare.previous', {
        delta: formatters.formatNumber(variation * 100, { maximumFractionDigits: 1, signDisplay: 'exceptZero' }),
      }),
    trend: variation === null || variation === 0 ? 'flat' : (variation > 0 ? 'up' : 'down'),
    error: report ? state.error : t('handler.not-found', { id: reportKey }),
  };
};
