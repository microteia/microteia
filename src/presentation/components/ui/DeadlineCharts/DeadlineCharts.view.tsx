import React from 'react';
import {
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { RiBarChartFill, RiEyeOffLine, RiEyeLine } from 'react-icons/ri';
import { useTheme } from 'styled-components';
import { useDeadlineChartsViewModel, type PeriodDays } from './DeadlineCharts.viewmodel';
import { S } from './DeadlineCharts.styles';
import type { Deadline } from '../../../../domain/entities';

export interface DeadlineChartsProps {
  deadlines: Deadline[];
}

const PERIOD_OPTIONS: PeriodDays[] = [7, 15, 30, 60];

export const DeadlineCharts: React.FC<DeadlineChartsProps> = ({ deadlines }) => {
  const vm = useDeadlineChartsViewModel(deadlines);
  const theme = useTheme();

  return (
    <S.Container>
      <S.Header>
        <S.HeaderLeft>
          <RiBarChartFill size={24} color={theme.colors.primary} />
          <S.Title>Análise de Prazos</S.Title>
        </S.HeaderLeft>
        <S.Controls>
          <S.ModeButton
            $active={vm.dateMode === 'dueDate'}
            onClick={() => vm.setDateMode('dueDate')}
          >
            Por Vencimento
          </S.ModeButton>
          <S.ModeButton
            $active={vm.dateMode === 'completedAt'}
            onClick={() => vm.setDateMode('completedAt')}
          >
            Por Conclusão
          </S.ModeButton>
          <S.PeriodGroup>
            {PERIOD_OPTIONS.map((days) => (
              <S.PeriodButton
                key={days}
                $active={vm.periodDays === days}
                onClick={() => vm.setPeriodDays(days)}
              >
                {days}d
              </S.PeriodButton>
            ))}
          </S.PeriodGroup>
          <S.ToggleButton onClick={vm.toggleCharts}>
            {vm.showCharts ? <RiEyeOffLine size={16} /> : <RiEyeLine size={16} />}
            {vm.showCharts ? 'Ocultar' : 'Exibir'}
          </S.ToggleButton>
        </S.Controls>
      </S.Header>

      {vm.showCharts && (
        <S.ChartsGrid>
          <S.ChartCard>
            <S.ChartTitle>
              {vm.dateMode === 'completedAt'
                ? 'Prazos por Dia — Por Tipo (Concluídos)'
                : 'Prazos por Dia — Por Tipo (Vencimento)'}
            </S.ChartTitle>
            {vm.allTypes.length > 0 && (
              <S.TypeChipsContainer>
                {vm.allTypes.map((type) => (
                  <S.TypeChip
                    key={type}
                    $color={vm.typeColorMap[type]}
                    $active={vm.visibleTypes.includes(type)}
                    onClick={() => vm.toggleTypeVisibility(type)}
                  >
                    {type}
                  </S.TypeChip>
                ))}
              </S.TypeChipsContainer>
            )}
            {vm.dailyData.length === 0 ? (
              <S.EmptyState>Nenhum dado disponível no período</S.EmptyState>
            ) : (
              <S.ChartWrapper>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={vm.dailyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke={theme.colors.border} />
                    <XAxis
                      dataKey="date"
                      stroke={theme.colors.textSecondary}
                      style={{ fontSize: 12 }}
                    />
                    <YAxis stroke={theme.colors.textSecondary} style={{ fontSize: 12 }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: theme.colors.surface,
                        border: `1px solid ${theme.colors.border}`,
                        borderRadius: theme.borderRadius.md,
                        fontSize: 12,
                      }}
                    />
                    {vm.visibleTypes.map((type) => (
                      <Line
                        key={type}
                        type="monotone"
                        dataKey={type}
                        name={type}
                        stroke={vm.typeColorMap[type]}
                        strokeWidth={2}
                        dot={{ r: 3 }}
                        activeDot={{ r: 5 }}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </S.ChartWrapper>
            )}
          </S.ChartCard>

          <S.ChartCard>
            <S.ChartTitle>Distribuição por Tipo</S.ChartTitle>
            {vm.typeData.length === 0 ? (
              <S.EmptyState>Nenhum prazo no período</S.EmptyState>
            ) : (
              <>
                <S.ChartWrapper>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={vm.typeData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={90}
                      >
                        {vm.typeData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </S.ChartWrapper>
                <S.TotalText>Total: {vm.totalInPeriod} no período</S.TotalText>
                <S.LegendList>
                  {vm.typeData.map((item) => (
                    <S.LegendItem key={item.name}>
                      <S.LegendDot $color={item.color} />
                      <S.LegendName>{item.name}</S.LegendName>
                      <S.LegendPercent>{item.percentage}%</S.LegendPercent>
                    </S.LegendItem>
                  ))}
                </S.LegendList>
              </>
            )}
          </S.ChartCard>
        </S.ChartsGrid>
      )}
    </S.Container>
  );
};
