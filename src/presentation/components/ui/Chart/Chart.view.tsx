import React, { Suspense, lazy } from 'react';
import { useTheme } from 'styled-components';
import { S } from './Chart.styles';

import { useT } from '../../../shared/i18n/useT';
/**
 * As duas primitivas de GRÁFICO da plataforma — série temporal e rosca. Elas não sabem o que estão
 * desenhando: recebem linhas prontas, com rótulo e cor decididos por quem tem o dado. Com mais de
 * uma série, a legenda as nomeia — sem ela, duas cores no mesmo eixo não dizem qual é qual. Foi assim que
 * a análise de prazos pôde sair do kernel sem perder o gráfico: quem conhece prazo é a extensão, e
 * quem sabe desenhar é aqui.
 *
 * A biblioteca de gráficos entra por `lazy`: ela é pesada e só é baixada quando um gráfico aparece
 * de fato na tela — o pacote principal não a carrega para quem nunca abre um.
 */

export interface ChartSeries {
  key: string;
  label: string;
  color: string;
}

export interface TimeSeriesChartProps {
  data: Array<Record<string, string | number>>;
  xKey: string;
  series: ChartSeries[];
  /** Preenche a área sob cada linha — o gráfico de área. Com `stacked`, as áreas se empilham. */
  filled?: boolean;
  stacked?: boolean;
  height?: number;
}

export interface BarChartProps {
  data: Array<Record<string, string | number>>;
  xKey: string;
  series: ChartSeries[];
  /** Empilha as séries em vez de pô-las lado a lado. */
  stacked?: boolean;
  /** Barras deitadas: a categoria no eixo vertical. É o que deixa rótulos longos legíveis. */
  horizontal?: boolean;
  height?: number;
}

export interface DonutSlice {
  name: string;
  value: number;
  color: string;
}

export interface DonutChartProps {
  data: DonutSlice[];
  /** Pizza cheia, sem o furo da rosca. */
  solid?: boolean;
  height?: number;
}

interface ChartTheme {
  grid: string;
  axis: string;
  surface: string;
  border: string;
  radius: string;
}

const LazyTimeSeries = lazy(async () => {
  const {
    Area, AreaChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
  } = await import('recharts');

  const Rendered: React.FC<TimeSeriesChartProps & { chartTheme: ChartTheme }> = ({
    data, xKey, series, filled, stacked, chartTheme,
  }) => (filled ? (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} />
        <XAxis dataKey={xKey} stroke={chartTheme.axis} style={{ fontSize: 12 }} />
        <YAxis stroke={chartTheme.axis} style={{ fontSize: 12 }} />
        <Tooltip
          contentStyle={{
            backgroundColor: chartTheme.surface,
            border: `1px solid ${chartTheme.border}`,
            borderRadius: chartTheme.radius,
            fontSize: 12,
          }}
        />
        {series.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
        {series.map((area) => (
          <Area
            key={area.key}
            type="monotone"
            dataKey={area.key}
            name={area.label}
            stroke={area.color}
            fill={area.color}
            fillOpacity={0.25}
            stackId={stacked ? 'one' : undefined}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  ) : (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} />
        <XAxis dataKey={xKey} stroke={chartTheme.axis} style={{ fontSize: 12 }} />
        <YAxis stroke={chartTheme.axis} style={{ fontSize: 12 }} allowDecimals={false} />
        <Tooltip
          contentStyle={{
            backgroundColor: chartTheme.surface,
            border: `1px solid ${chartTheme.border}`,
            borderRadius: chartTheme.radius,
            fontSize: 12,
          }}
        />
        {series.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
        {series.map((line) => (
          <Line
            key={line.key}
            type="monotone"
            dataKey={line.key}
            name={line.label}
            stroke={line.color}
            strokeWidth={2}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  ));

  return { default: Rendered };
});

const LazyBar = lazy(async () => {
  const {
    Bar, BarChart: RechartsBar, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis,
  } = await import('recharts');

  const Rendered: React.FC<BarChartProps & { chartTheme: ChartTheme }> = ({
    data, xKey, series, stacked, horizontal, chartTheme,
  }) => (
    <ResponsiveContainer width="100%" height="100%">
      <RechartsBar data={data} layout={horizontal ? 'vertical' : 'horizontal'}>
        <CartesianGrid
          strokeDasharray="3 3"
          stroke={chartTheme.grid}
          vertical={horizontal === true}
          horizontal={horizontal !== true}
        />
        {horizontal ? (
          <>
            <XAxis type="number" stroke={chartTheme.axis} style={{ fontSize: 12 }} />
            <YAxis type="category" dataKey={xKey} stroke={chartTheme.axis} style={{ fontSize: 12 }} width={120} />
          </>
        ) : (
          <>
            <XAxis dataKey={xKey} stroke={chartTheme.axis} style={{ fontSize: 12 }} />
            <YAxis stroke={chartTheme.axis} style={{ fontSize: 12 }} />
          </>
        )}
        <Tooltip
          contentStyle={{
            backgroundColor: chartTheme.surface,
            border: `1px solid ${chartTheme.border}`,
            borderRadius: chartTheme.radius,
            fontSize: 12,
          }}
        />
        {series.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
        {series.map((bar) => (
          <Bar
            key={bar.key}
            dataKey={bar.key}
            name={bar.label}
            fill={bar.color}
            stackId={stacked ? 'one' : undefined}
            radius={horizontal ? [0, 3, 3, 0] : [3, 3, 0, 0]}
          />
        ))}
      </RechartsBar>
    </ResponsiveContainer>
  );

  return { default: Rendered };
});

const LazyDonut = lazy(async () => {
  const { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } = await import('recharts');

  const Rendered: React.FC<DonutChartProps> = ({ data, solid }) => (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          innerRadius={solid ? 0 : '55%'}
          outerRadius="80%"
        >
          {data.map((slice) => (
            <Cell key={slice.name} fill={slice.color} />
          ))}
        </Pie>
        <Tooltip />
      </PieChart>
    </ResponsiveContainer>
  );

  return { default: Rendered };
});

export const TimeSeriesChart: React.FC<TimeSeriesChartProps> = ({
  data, xKey, series, filled, stacked, height = 240,
}) => {
  const theme = useTheme();
  const t = useT('core.ui');
  const chartTheme: ChartTheme = {
    grid: theme.colors.border,
    axis: theme.colors.textSecondary,
    surface: theme.colors.surface,
    border: theme.colors.border,
    radius: theme.borderRadius.md,
  };

  return (
    <S.Frame $height={height}>
      <Suspense fallback={<S.Placeholder>{t('chart.loading')}</S.Placeholder>}>
        <LazyTimeSeries
          data={data}
          xKey={xKey}
          series={series}
          filled={filled}
          stacked={stacked}
          chartTheme={chartTheme}
        />
      </Suspense>
    </S.Frame>
  );
};

export const BarChart: React.FC<BarChartProps> = ({
  data, xKey, series, stacked, horizontal, height = 240,
}) => {
  const theme = useTheme();
  const t = useT('core.ui');
  const chartTheme: ChartTheme = {
    grid: theme.colors.border,
    axis: theme.colors.textSecondary,
    surface: theme.colors.surface,
    border: theme.colors.border,
    radius: theme.borderRadius.md,
  };

  return (
    <S.Frame $height={height}>
      <Suspense fallback={<S.Placeholder>{t('chart.loading')}</S.Placeholder>}>
        <LazyBar
          data={data}
          xKey={xKey}
          series={series}
          stacked={stacked}
          horizontal={horizontal}
          chartTheme={chartTheme}
        />
      </Suspense>
    </S.Frame>
  );
};

export const DonutChart: React.FC<DonutChartProps> = ({ data, solid, height = 240 }) => {
  const t = useT('core.ui');

  return (
    <S.Frame $height={height}>
      <Suspense fallback={<S.Placeholder>{t('chart.loading')}</S.Placeholder>}>
        <LazyDonut data={data} solid={solid} />
      </Suspense>
    </S.Frame>
  );
};
