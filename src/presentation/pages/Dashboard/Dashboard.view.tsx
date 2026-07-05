import React from 'react';
import {
  RiFolderLine,
  RiTeamLine,
  RiTimeLine,
  RiAlertLine,
  RiArrowRightLine,
  RiMoneyDollarCircleLine,
  RiLineChartLine,
} from 'react-icons/ri';
import { useDashboardViewModel, type FinancialPeriodDays } from './Dashboard.viewmodel';
import { Card, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Spinner } from '../../components/ui/Spinner';
import { DeadlineCharts } from '../../components/ui/DeadlineCharts';
import { S } from './Dashboard.styles';
import { useTheme } from 'styled-components';

const FINANCIAL_PERIOD_OPTIONS: FinancialPeriodDays[] = [7, 15, 30];

const KPI_ICONS = [
  <RiFolderLine size={22} />,
  <RiTeamLine size={22} />,
  <RiTimeLine size={22} />,
  <RiAlertLine size={22} />,
];

export const DashboardView: React.FC = () => {
  const vm = useDashboardViewModel();
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
      <S.KPIGrid>
        {vm.kpis.map((kpi, i) => (
          <S.KPICard key={kpi.label} $clickable={!!kpi.onClick} onClick={kpi.onClick}>
            <S.KPIIcon $color={kpi.color}>{KPI_ICONS[i]}</S.KPIIcon>
            <div>
              <S.KPIValue>{kpi.value}</S.KPIValue>
              <S.KPILabel>{kpi.label}</S.KPILabel>
            </div>
          </S.KPICard>
        ))}
      </S.KPIGrid>

      <DeadlineCharts deadlines={vm.allDeadlines} />

      <S.BottomGrid>
        <Card>
          <CardHeader>
            <CardTitle>Prazos nos Próximos 7 Dias</CardTitle>
            <Button size="sm" variant="ghost" onClick={vm.openDeadlines}>
              Ver todos <RiArrowRightLine size={14} />
            </Button>
          </CardHeader>
          {vm.upcomingDeadlines.length === 0 ? (
            <S.EmptyState>Nenhum prazo nos próximos 7 dias 🎉</S.EmptyState>
          ) : (
            <S.List>
              {vm.upcomingDeadlines.map((item) => (
                <S.DeadlineItem key={item.deadline.id} $today={item.isToday} onClick={() => vm.openDeadline(item.deadline)}>
                  <div style={{ width: 4, height: 32, borderRadius: 4, background: item.priorityColor, flexShrink: 0 }} />
                  <S.DeadlineInfo>
                    <S.DeadlineTitle>{item.deadline.type}</S.DeadlineTitle>
                    <S.DeadlineSub>
                      <S.DeadlineCaseLink onClick={(e) => { e.stopPropagation(); vm.openCase(item.deadline.caseId); }}>
                        {item.caseNumberDisplay}
                      </S.DeadlineCaseLink>
                    </S.DeadlineSub>
                  </S.DeadlineInfo>
                  <S.PriorityBadge $color={item.priorityColor}>{item.deadline.priority}</S.PriorityBadge>
                  <S.DaysChip $today={item.isToday || item.isTomorrow}>
                    {item.isToday ? 'Hoje' : item.isTomorrow ? 'Amanhã' : `${item.daysLeft}d`}
                  </S.DaysChip>
                </S.DeadlineItem>
              ))}
            </S.List>
          )}
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Prazos Vencidos</CardTitle>
            <Button size="sm" variant="ghost" onClick={vm.openDeadlinesOverdue}>
              Ver todos <RiArrowRightLine size={14} />
            </Button>
          </CardHeader>
          {vm.overdueDeadlines.length === 0 ? (
            <S.EmptyState>Nenhum prazo vencido 👍</S.EmptyState>
          ) : (
            <S.List>
              {vm.overdueDeadlines.slice(0, 6).map((item) => (
                <S.DeadlineItem key={item.deadline.id} $overdue onClick={() => vm.openDeadline(item.deadline)}>
                  <div style={{ width: 4, height: 32, borderRadius: 4, background: item.priorityColor, flexShrink: 0 }} />
                  <S.DeadlineInfo>
                    <S.DeadlineTitle>{item.deadline.type}</S.DeadlineTitle>
                    <S.DeadlineSub>
                      <S.DeadlineCaseLink onClick={(e) => { e.stopPropagation(); vm.openCase(item.deadline.caseId); }}>
                        {item.caseNumberDisplay}
                      </S.DeadlineCaseLink>
                    </S.DeadlineSub>
                  </S.DeadlineInfo>
                  <S.PriorityBadge $color={item.priorityColor}>{item.deadline.priority}</S.PriorityBadge>
                  <S.DaysChip $overdue>
                    <RiAlertLine size={10} style={{ marginRight: 2 }} />
                    {item.daysOverdue}d vencido
                  </S.DaysChip>
                </S.DeadlineItem>
              ))}
            </S.List>
          )}
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Processos Recentes</CardTitle>
            <Button size="sm" variant="ghost" onClick={vm.openCasesActive}>
              Ver todos <RiArrowRightLine size={14} />
            </Button>
          </CardHeader>
          {vm.recentCases.length === 0 ? (
            <S.EmptyState>Nenhum processo ativo</S.EmptyState>
          ) : (
            <S.List>
              {vm.recentCases.map((c) => (
                <S.DeadlineItem key={c.id} onClick={() => vm.openCase(c.id)}>
                  <div style={{ width: 4, height: 32, borderRadius: 4, background: theme.colors.kpiCases, flexShrink: 0 }} />
                  <S.DeadlineInfo>
                    <S.DeadlineTitle>{c.title}</S.DeadlineTitle>
                    <S.DeadlineSub>
                      <S.DeadlineCaseLink onClick={(e) => { e.stopPropagation(); vm.openCase(c.id); }}>
                        {c.caseNumber}
                      </S.DeadlineCaseLink>
                      {c.instance && ` · ${c.instance}`}
                      {c.court && ` · ${c.court}`}
                    </S.DeadlineSub>
                  </S.DeadlineInfo>
                  {c.filedAt && (
                    <S.DaysChip>
                      {c.filedAt.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                    </S.DaysChip>
                  )}
                </S.DeadlineItem>
              ))}
            </S.List>
          )}
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Financeiro</CardTitle>
            <S.FinancialHeaderControls>
              <S.PeriodGroup>
                {FINANCIAL_PERIOD_OPTIONS.map((days) => (
                  <S.PeriodButton
                    key={days}
                    $active={vm.financialPeriodDays === days}
                    onClick={() => vm.setFinancialPeriodDays(days)}
                  >
                    {days}d
                  </S.PeriodButton>
                ))}
              </S.PeriodGroup>
              <Button size="sm" variant="ghost" onClick={vm.openFinancialDashboard}>
                <RiLineChartLine size={14} /> Dashboard
              </Button>
              <Button size="sm" variant="ghost" onClick={vm.openFinancials}>
                <RiMoneyDollarCircleLine size={14} /> Ver tudo
              </Button>
            </S.FinancialHeaderControls>
          </CardHeader>
          <S.FinancialRow>
            <S.FinancialLabel>Receitas a receber</S.FinancialLabel>
            <S.FinancialValue $color={theme.colors.revenue}>{vm.formatAmount(vm.pendingIncome)}</S.FinancialValue>
          </S.FinancialRow>
          <S.FinancialRow>
            <S.FinancialLabel>Despesas a pagar</S.FinancialLabel>
            <S.FinancialValue $color={theme.colors.expense}>{vm.formatAmount(vm.pendingExpense)}</S.FinancialValue>
          </S.FinancialRow>
          <S.FinancialRow>
            <S.FinancialLabel>Saldo projetado</S.FinancialLabel>
            <S.FinancialValue $color={vm.pendingIncome - vm.pendingExpense >= 0 ? theme.colors.revenue : theme.colors.expense}>
              {vm.formatAmount(vm.pendingIncome - vm.pendingExpense)}
            </S.FinancialValue>
          </S.FinancialRow>
        </Card>
      </S.BottomGrid>
    </S.Page>
  );
};
