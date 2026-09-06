import React from 'react';
import { S } from './ReportChart.styles';
import { useReportChartViewModel } from './ReportChart.viewmodel';
import { BarChart, DonutChart, TimeSeriesChart } from '../Chart';
import type { ReportResult } from '../../../../domain/schema/report/reportResult';
import type { ReportSpec } from '../../../../domain/schema/report/reportSpec';

export interface ReportChartProps {
  spec: ReportSpec;
  result: ReportResult | null;
}

/**
 * O gráfico do relatório.
 *
 * Marca que este kernel não desenha simplesmente não aparece — degradação de nível 1, e a tabela
 * continua mostrando o mesmo dado. É por isso que descartar o gráfico é seguro e descartar uma
 * medida não seria: aqui a perda se vê.
 */
export const ReportChart: React.FC<ReportChartProps> = ({ spec, result }) => {
  const vm = useReportChartViewModel(spec, result);

  if (vm.mark === null) return null;

  return (
    <S.Frame>
      {vm.mark === 'bar' && (
        <BarChart data={vm.data} xKey="name" series={vm.series} stacked={vm.stacked} height={vm.height} />
      )}
      {vm.mark === 'line' && (
        <TimeSeriesChart data={vm.data} xKey="name" series={vm.series} height={vm.height} />
      )}
      {vm.mark === 'donut' && <DonutChart data={vm.slices} height={vm.height} />}
    </S.Frame>
  );
};
