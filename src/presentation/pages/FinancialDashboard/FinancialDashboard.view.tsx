import React from 'react';
import {
  ComposedChart,
  Bar,
  Line,
  LineChart,
  PieChart,
  Pie,
  Cell,
  BarChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type { ValueType } from 'recharts/types/component/DefaultTooltipContent';
import { RiLineChartLine, RiMoneyDollarCircleLine, RiInboxLine } from 'react-icons/ri';
import { useTheme } from 'styled-components';
import { useFinancialDashboardViewModel } from './FinancialDashboard.viewmodel';
import { Button } from '../../components/ui/Button';
import { Spinner } from '../../components/ui/Spinner';
import { CompositeFilter } from '../../components/ui/CompositeFilter';
import { S } from './FinancialDashboard.styles';

export const FinancialDashboardView: React.FC = () => {
  const vm = useFinancialDashboardViewModel();
  const theme = useTheme();

  if (vm.isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <Spinner size={40} />
      </div>
    );
  }

  return (
    <S.Page>
      <S.Header>
        <S.HeaderLeft>
          <RiLineChartLine size={24} />
          <div>
            <S.Title>Dashboard Financeiro</S.Title>
            <S.Subtitle>Fluxo de caixa, categorias e contas em aberto</S.Subtitle>
          </div>
        </S.HeaderLeft>
        <Button size="sm" variant="secondary" onClick={vm.openFinancials}>
          <RiMoneyDollarCircleLine size={14} /> Ver Lançamentos
        </Button>
      </S.Header>

      <S.Toolbar>
        <CompositeFilter
          defs={vm.filterDefs}
          tokens={vm.filterTokens}
          onChange={vm.setFilterTokens}
          placeholder="Filtrar lançamentos..."
          screenKey={vm.savedFiltersScreenKey}
        />
      </S.Toolbar>

      {!vm.hasData ? (
        <S.PageEmptyState>
          <RiInboxLine />
          <div>Nenhum lançamento financeiro cadastrado ainda</div>
        </S.PageEmptyState>
      ) : (
        <>
          <S.KPIGrid>
            {vm.kpis.map((kpi) => (
              <S.KPICard key={kpi.label} $color={kpi.color}>
                <S.KPILabel>{kpi.label}</S.KPILabel>
                <S.KPIValue $color={kpi.color}>{kpi.value}</S.KPIValue>
              </S.KPICard>
            ))}
          </S.KPIGrid>

          <S.ChartCard>
            <S.ChartCardHeader>
              <S.ChartTitle>Fluxo de Caixa Mensal</S.ChartTitle>
            </S.ChartCardHeader>
            <S.ChartWrapper>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={vm.monthlyFlow}>
                  <CartesianGrid strokeDasharray="3 3" stroke={theme.colors.border} />
                  <XAxis dataKey="month" stroke={theme.colors.textSecondary} style={{ fontSize: 12 }} />
                  <YAxis stroke={theme.colors.textSecondary} style={{ fontSize: 12 }} tickFormatter={vm.formatCompactAmount} />
                  <Tooltip
                    formatter={(value: ValueType | undefined) => vm.formatAmount(Number(value))}
                    contentStyle={{
                      backgroundColor: theme.colors.surface,
                      border: `1px solid ${theme.colors.border}`,
                      borderRadius: theme.borderRadius.md,
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey="Receita" fill={theme.colors.revenue} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Despesa" fill={theme.colors.expense} radius={[4, 4, 0, 0]} />
                  <Line type="monotone" dataKey="Saldo" stroke={theme.colors.primary} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </S.ChartWrapper>
          </S.ChartCard>

          <S.ChartsGrid>
            <S.ChartCard>
              <S.ChartCardHeader>
                <S.ChartTitle>Distribuição por Categoria</S.ChartTitle>
                <S.ModeGroup>
                  <S.ModeButton $type="Receita" $active={vm.categoryType === 'Receita'} onClick={() => vm.setCategoryType('Receita')}>
                    Receitas
                  </S.ModeButton>
                  <S.ModeButton $type="Despesa" $active={vm.categoryType === 'Despesa'} onClick={() => vm.setCategoryType('Despesa')}>
                    Despesas
                  </S.ModeButton>
                </S.ModeGroup>
              </S.ChartCardHeader>
              {vm.allCategories.length > 0 && (
                <S.TypeChipsContainer>
                  {vm.allCategories.map((category) => (
                    <S.TypeChip
                      key={category}
                      $color={vm.categoryColorMap[category]}
                      $active={vm.visibleCategories.includes(category)}
                      onClick={() => vm.toggleCategoryVisibility(category)}
                    >
                      {vm.categoryLabelMap[category]}
                    </S.TypeChip>
                  ))}
                </S.TypeChipsContainer>
              )}
              {vm.dailyCategoryData.length === 0 || vm.allCategories.length === 0 ? (
                <S.EmptyState>Nenhum lançamento no período</S.EmptyState>
              ) : (
                <S.ChartWrapper>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={vm.dailyCategoryData}>
                      <CartesianGrid strokeDasharray="3 3" stroke={theme.colors.border} />
                      <XAxis dataKey="date" stroke={theme.colors.textSecondary} style={{ fontSize: 12 }} />
                      <YAxis stroke={theme.colors.textSecondary} style={{ fontSize: 12 }} tickFormatter={vm.formatCompactAmount} />
                      <Tooltip
                        formatter={(value: ValueType | undefined) => vm.formatAmount(Number(value))}
                        contentStyle={{
                          backgroundColor: theme.colors.surface,
                          border: `1px solid ${theme.colors.border}`,
                          borderRadius: theme.borderRadius.md,
                          fontSize: 12,
                        }}
                      />
                      {vm.visibleCategories.map((category) => (
                        <Line
                          key={category}
                          type="monotone"
                          dataKey={category}
                          name={vm.categoryLabelMap[category]}
                          stroke={vm.categoryColorMap[category]}
                          strokeWidth={2}
                          dot={{ r: 2 }}
                          activeDot={{ r: 5 }}
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </S.ChartWrapper>
              )}
            </S.ChartCard>

            <S.ChartCard>
              <S.ChartCardHeader>
                <S.ChartTitle>Receitas x Despesas</S.ChartTitle>
              </S.ChartCardHeader>
              {vm.incomeVsExpense.length === 0 ? (
                <S.EmptyState>Nenhum lançamento pago no período</S.EmptyState>
              ) : (
                <>
                  <S.ChartWrapper>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={vm.incomeVsExpense} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={55} outerRadius={85}>
                          {vm.incomeVsExpense.map((entry, index) => (
                            <Cell key={`ie-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value: ValueType | undefined) => vm.formatAmount(Number(value))} />
                      </PieChart>
                    </ResponsiveContainer>
                  </S.ChartWrapper>
                  <S.TotalText>Total: {vm.formatAmount(vm.incomeVsExpenseTotal)}</S.TotalText>
                  <S.LegendList>
                    {vm.incomeVsExpense.map((item) => (
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

          <S.ChartsRow>
            <S.ChartCard>
              <S.ChartCardHeader>
                <S.ChartTitle>Lançamentos por Status</S.ChartTitle>
              </S.ChartCardHeader>
              {vm.statusDistribution.length === 0 ? (
                <S.EmptyState>Nenhum lançamento no período</S.EmptyState>
              ) : (
                <>
                  <S.ChartWrapper>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={vm.statusDistribution} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={55} outerRadius={85}>
                          {vm.statusDistribution.map((entry, index) => (
                            <Cell key={`status-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value: ValueType | undefined) => vm.formatAmount(Number(value))} />
                      </PieChart>
                    </ResponsiveContainer>
                  </S.ChartWrapper>
                  <S.TotalText>Total: {vm.formatAmount(vm.statusTotal)}</S.TotalText>
                  <S.LegendList>
                    {vm.statusDistribution.map((item) => (
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

            <S.ChartCard>
              <S.ChartCardHeader>
                <S.ChartTitle>Contas em Aberto por Vencimento</S.ChartTitle>
              </S.ChartCardHeader>
              <S.ChartWrapper>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={vm.agingBuckets}>
                    <CartesianGrid strokeDasharray="3 3" stroke={theme.colors.border} />
                    <XAxis dataKey="label" stroke={theme.colors.textSecondary} style={{ fontSize: 11 }} />
                    <YAxis stroke={theme.colors.textSecondary} style={{ fontSize: 12 }} tickFormatter={vm.formatCompactAmount} />
                    <Tooltip
                      formatter={(value: ValueType | undefined) => vm.formatAmount(Number(value))}
                      contentStyle={{
                        backgroundColor: theme.colors.surface,
                        border: `1px solid ${theme.colors.border}`,
                        borderRadius: theme.borderRadius.md,
                        fontSize: 12,
                      }}
                    />
                    <Bar dataKey="Receita" fill={theme.colors.revenue} radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Despesa" fill={theme.colors.expense} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </S.ChartWrapper>
            </S.ChartCard>
          </S.ChartsRow>
        </>
      )}
    </S.Page>
  );
};
