import { useCallback } from 'react';
import { useT } from './i18n/useT';
import { isDeclarableReportPeriod, REPORT_PERIODS, reportPeriodLabel } from '../../domain/schema/report/reportPeriod';

export interface ReportPeriodOption {
  value: string;
  label: string;
}

/**
 * As opções de um seletor de período: "qualquer período" e os que o filtro OFERECE (`periods`, ou os
 * nomeados), na ordem declarada.
 *
 * Um só lugar para os três seletores — o do relatório, o da barra do painel e o do editor —, porque o
 * parametrizado precisa do plural (`period.last.months` com `count`), e três montagens à mão eram três
 * chances de um deles mostrar `last-12-months` cru.
 *
 * O valor ATUAL entra no fim quando não está entre os oferecidos: um padrão que o seletor não lista
 * apareceria em branco, e quem lê acharia que o relatório está sem recorte.
 */
export const useReportPeriodOptions = (): ((periods?: readonly string[], current?: string) => ReportPeriodOption[]) => {
  const t = useT('core.reports');
  return useCallback((periods, current) => {
    const offered: readonly string[] = periods && periods.length > 0 ? periods : REPORT_PERIODS;
    const shown = current && isDeclarableReportPeriod(current) && !offered.includes(current)
      ? [...offered, current]
      : offered;
    return [
      { value: '', label: t('period.any') },
      ...shown.map((period) => {
        const name = reportPeriodLabel(period);
        return { value: period, label: name ? t(name.key, name.params) : period };
      }),
    ];
  }, [t]);
};
