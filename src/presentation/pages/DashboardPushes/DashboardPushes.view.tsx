import React from 'react';
import { RiBarChartBoxLine, RiInboxLine } from 'react-icons/ri';
import { S } from './DashboardPushes.styles';
import { useDashboardPushesViewModel } from './DashboardPushes.viewmodel';
import { Spinner } from '../../components/ui/Spinner';

export const DashboardPushesView: React.FC = () => {
  const vm = useDashboardPushesViewModel();

  if (vm.loading) {
    return (
      <S.Page>
        <Spinner />
      </S.Page>
    );
  }

  if (vm.metrics.total === 0) {
    return (
      <S.Page>
        <S.Header>
          <S.TitleRow>
            <RiBarChartBoxLine size={24} />
            <S.Title>Dashboard de Pushes</S.Title>
          </S.TitleRow>
          <S.Subtitle>Análise e métricas dos pushes recebidos do tribunal</S.Subtitle>
        </S.Header>
        <S.EmptyState>
          <RiInboxLine />
          <p>Nenhum push recebido ainda</p>
        </S.EmptyState>
      </S.Page>
    );
  }

  return (
    <S.Page>
      <S.Header>
        <S.TitleRow>
          <RiBarChartBoxLine size={24} />
          <S.Title>Dashboard de Pushes</S.Title>
        </S.TitleRow>
        <S.Subtitle>Análise e métricas dos pushes recebidos do tribunal</S.Subtitle>
      </S.Header>

      <S.Grid>
        <S.MetricCard>
          <S.MetricLabel>Total de Pushes</S.MetricLabel>
          <S.MetricValue>{vm.metrics.total}</S.MetricValue>
          <S.MetricSubtext>Pushes recebidos</S.MetricSubtext>
        </S.MetricCard>

        <S.MetricCard>
          <S.MetricLabel>Não Lidos</S.MetricLabel>
          <S.MetricValue>{vm.metrics.unread}</S.MetricValue>
          <S.MetricSubtext>
            {vm.metrics.total > 0
              ? `${Math.round((vm.metrics.unread / vm.metrics.total) * 100)}% do total`
              : '0% do total'}
          </S.MetricSubtext>
        </S.MetricCard>

        <S.MetricCard>
          <S.MetricLabel>Pendentes</S.MetricLabel>
          <S.MetricValue>{vm.metrics.pending}</S.MetricValue>
          <S.MetricSubtext>Aguardando revisão</S.MetricSubtext>
        </S.MetricCard>

        <S.MetricCard $variant="danger">
          <S.MetricLabel>Falhas de Parsing</S.MetricLabel>
          <S.MetricValue>{vm.metrics.fault}</S.MetricValue>
          <S.MetricSubtext>
            {vm.metrics.total > 0
              ? `${Math.round((vm.metrics.fault / vm.metrics.total) * 100)}% do total`
              : '0% do total'}
          </S.MetricSubtext>
        </S.MetricCard>
      </S.Grid>

      <S.ChartsRow>
        <S.ChartCard>
          <S.ChartTitle>Distribuição por Status</S.ChartTitle>
          <S.BarChart>
            {vm.statusData.map(item => (
              <S.BarRow key={item.label}>
                <S.BarLabel>{item.label}</S.BarLabel>
                <S.BarTrack>
                  <S.BarFill $percent={item.percent} $color={item.color}>
                    {item.count}
                  </S.BarFill>
                </S.BarTrack>
              </S.BarRow>
            ))}
          </S.BarChart>
        </S.ChartCard>

        <S.ChartCard>
          <S.ChartTitle>Método de Parsing</S.ChartTitle>
          <S.BarChart>
            {vm.parsingData.map(item => (
              <S.BarRow key={item.label}>
                <S.BarLabel>{item.label}</S.BarLabel>
                <S.BarTrack>
                  <S.BarFill $percent={item.percent}>
                    {item.count}
                  </S.BarFill>
                </S.BarTrack>
              </S.BarRow>
            ))}
          </S.BarChart>
        </S.ChartCard>
      </S.ChartsRow>

      <S.ChartsRow>
        <S.ChartCard>
          <S.ChartTitle>Pushes por Tribunal</S.ChartTitle>
          <S.BarChart>
            {vm.courtStats.slice(0, 5).map(stat => (
              <S.BarRow key={stat.court}>
                <S.BarLabel>{stat.court}</S.BarLabel>
                <S.BarTrack>
                  <S.BarFill $percent={stat.percent}>
                    {stat.count}
                  </S.BarFill>
                </S.BarTrack>
              </S.BarRow>
            ))}
          </S.BarChart>
        </S.ChartCard>

        <S.ChartCard>
          <S.ChartTitle>Últimos 7 Dias</S.ChartTitle>
          <S.Timeline>
            {vm.timelineData.map(item => (
              <S.TimelineBar key={item.label} $height={item.height} title={`${item.label}: ${item.count} pushes`} />
            ))}
          </S.Timeline>
          <S.TimelineLabel>
            <span>{vm.timelineData[0]?.label}</span>
            <span>{vm.timelineData[vm.timelineData.length - 1]?.label}</span>
          </S.TimelineLabel>
        </S.ChartCard>
      </S.ChartsRow>
    </S.Page>
  );
};
