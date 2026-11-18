import { useCallback, useMemo } from 'react';
import { useReportFrame } from '@microteia/report';
import { useLocaleFormat, useT } from '@microteia/i18n';

/** The prompt this view answers — `presentation.prompts[].key` of the report it draws. */
const PERIOD_PROMPT = 'period';

/** Periods offered as buttons. Any `REPORT_PERIODS` value is valid; these are the ones worth one click. */
const PERIODS = ['this-month', 'this-year', 'last-year'] as const;

/**
 * Everything the overview decides, so the view only draws.
 *
 * The data comes from the FRAME — the report tab around this view — and never from `useReport`. The
 * frame is what runs the report, so Export and Subscribe act on the result and the answers shown
 * here. A view that fetched its own numbers would show one thing and export another.
 */
export const useOverviewViewModel = () => {
  const t = useT('com.microteia.report-view-example');
  const { formatMoney, formatNumber } = useLocaleFormat();
  const frame = useReportFrame();

  // The frame remembers the answers the report last ran with. ABSENT means it has not run yet, and no
  // button is lit; `null` is an answer — "no restriction" — and lights "All time". Sending `null`
  // rather than leaving the key out is what overrides the report's default period.
  const answered = frame ? frame.prompts[PERIOD_PROMPT] : undefined;

  const choose = useCallback(
    (period: string | null) => {
      void frame?.run({ [PERIOD_PROMPT]: period });
    },
    [frame],
  );

  const periods = useMemo(
    () => [
      ...PERIODS.map((period) => ({
        key: period,
        label: t(`period.${period}`),
        active: answered === period,
        onClick: () => choose(period),
      })),
      { key: 'all', label: t('period.all'), active: answered === null, onClick: () => choose(null) },
    ],
    [t, answered, choose],
  );

  // Every number below is a measure of the report, read from the grand total. The average is
  // `total / count` DECLARED as a computed measure, not divided here: a number the view computes is a
  // number that the export, the agent and the automation never see.
  // A measure the report could not compute — the average of nothing divides by zero — arrives as
  // `null`. It is shown as a dash: an empty tile looks broken, and a zero would claim a number.
  const headline = useMemo(() => {
    const totals = frame?.result?.totals;
    if (!totals) return [];
    const shown = (value: number | null, format: (one: number) => string): string =>
      value === null || value === undefined ? '—' : format(value);
    return [
      { key: 'total', label: t('overview.total'), value: shown(totals.values.total, formatMoney) },
      { key: 'count', label: t('overview.count'), value: shown(totals.values.count, formatNumber) },
      { key: 'average', label: t('overview.average'), value: shown(totals.values.average, formatMoney) },
    ];
  }, [frame, t, formatMoney, formatNumber]);

  return {
    t,
    /** `null` outside the report tab: the same view could be mounted somewhere else, and there it has no report. */
    inFrame: frame !== null,
    loading: frame !== null && frame.isLoading && !frame.result,
    periods,
    headline,
    spec: frame?.report.spec,
    result: frame?.result ?? null,
  };
};
