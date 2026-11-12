import React from 'react';
import { S } from './ReportMetric.styles';
import { useReportMetricViewModel } from './ReportMetric.viewmodel';
import type { ReportMetricProps } from './ReportMetric.viewmodel';

/** O indicador ligado a um relatório: o número grande, a legenda e, quando há, a variação. */
export const ReportMetric: React.FC<ReportMetricProps> = (props) => {
  const vm = useReportMetricViewModel(props);

  return (
    <S.Metric>
      <S.Value $muted={vm.isLoading}>{vm.value}</S.Value>
      <S.Label>{vm.label}</S.Label>
      {vm.delta && <S.Delta $trend={vm.trend}>{vm.delta}</S.Delta>}
      {vm.error && <S.Error>{vm.error}</S.Error>}
    </S.Metric>
  );
};
