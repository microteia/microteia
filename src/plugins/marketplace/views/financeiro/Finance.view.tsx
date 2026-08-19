import { useMemo, useState } from 'react';
import { styled, useTheme } from 'styled-components';
import { RecordListSurface, Badge, Button, InfoBanner } from '@microteia/ui';
import { useEntityList, useLookup } from '@microteia/data';
import { getConfigColor } from '@microteia/theme';
import { formatCurrencyBRL, formatDate } from '@microteia/format';

const SOURCE_ID = 'microteia:financeiro';

const Header = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.xs};
`;

const Totals = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.spacing.lg};
  padding: ${({ theme }) => theme.spacing.sm + ' ' + theme.spacing.xl};
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  background: ${({ theme }) => theme.colors.surface};
`;

const Total = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
`;

const TotalLabel = styled.span`
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: ${({ theme }) => theme.colors.textMuted};
`;

const TotalValue = styled.span`
  font-size: ${({ theme }) => theme.fontSizes.md};
  font-weight: 700;
  font-family: ${({ theme }) => theme.fonts.mono};
  color: ${({ $color, theme }) => $color || theme.colors.text};
`;

const CardRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing.sm};
  flex-wrap: wrap;
`;

const Amount = styled.span`
  font-size: ${({ theme }) => theme.fontSizes.md};
  font-weight: 700;
  font-family: ${({ theme }) => theme.fonts.mono};
  color: ${({ $color }) => $color};
  white-space: nowrap;
`;

const startOfMonth = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
};

const endOfMonth = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 0);
};

const iso = (date) => {
  const pad = (n) => String(n).padStart(2, '0');
  return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate());
};

// O mês corrente é a visão útil de quem abre o Financeiro: sem isso, a primeira tela é o histórico
// inteiro do escritório.
const MES_CORRENTE = [
  { key: 'dueDate', values: [iso(startOfMonth())] },
  { key: 'dueDate:ate', values: [iso(endOfMonth())] },
];

const sum = (records, type, status) => records
  .filter((r) => r.type === type && r.status === status)
  .reduce((total, r) => total + (Number(r.amount) || 0), 0);

export default function FinanceiroView() {
  const theme = useTheme();
  const list = useEntityList(SOURCE_ID, { defaultFilterTokens: MES_CORRENTE });
  const statusOptions = useLookup('financialStatuses');
  const [showTotals, setShowTotals] = useState(true);

  const totals = useMemo(() => {
    const records = list.filteredRecords;
    const recebido = sum(records, 'Receita', 'Pago');
    const pago = sum(records, 'Despesa', 'Pago');
    const aReceber = sum(records, 'Receita', 'Aberto');
    const aPagar = sum(records, 'Despesa', 'Aberto');
    return { recebido, pago, saldo: recebido - pago, aReceber, aPagar, previsto: recebido - pago - aReceber - aPagar };
  }, [list.filteredRecords]);

  if (!list.definition) {
    return <div style={{ padding: '24px' }}><InfoBanner message='Tela "Financeiro" não encontrada. Instale a extensão para ativá-la.' variant="warning" /></div>;
  }

  const amountColor = (record) => record.type === 'Despesa' ? theme.colors.expense : theme.colors.revenue;

  const statusColor = (record) => {
    // A data chega como Date (o store converte o Timestamp): comparar pelo DIA, no fuso do
    // escritório. Comparar como texto não funciona: String(new Date()) é "Wed Aug 12 2026".
    const vencido = record.status === 'Aberto' && record.dueDate && iso(new Date(record.dueDate)) < iso(new Date());
    return vencido ? theme.colors.danger : getConfigColor(statusOptions, record.status, theme);
  };

  const renderBelowHeader = (record) => (
    <CardRow>
      <Badge color={statusColor(record)}>{record.status}</Badge>
      <Amount $color={amountColor(record)}>
        {record.type === 'Despesa' ? '-' : '+'} {formatCurrencyBRL(Number(record.amount) || 0)}
      </Amount>
    </CardRow>
  );

  // As três datas numa linha só: separadas, "12/08 · 15/08" vira duas linhas que não se explicam.
  const renderMetaRows = (record) => {
    const parts = [formatDate(record.dueDate)];
    if (record.paymentDate) parts.push('pago em ' + formatDate(record.paymentDate));
    if (record.cancelDate) parts.push('cancelado em ' + formatDate(record.cancelDate));
    return [{ key: 'datas', value: parts.filter(Boolean).join(' · ') }];
  };

  const total = (label, value, color) => (
    <Total>
      <TotalLabel>{label}</TotalLabel>
      <TotalValue $color={color}>{formatCurrencyBRL(value)}</TotalValue>
    </Total>
  );

  const summary = showTotals ? (
    <Totals>
      {total('Recebido', totals.recebido, theme.colors.revenue)}
      {total('Pago', totals.pago, theme.colors.expense)}
      {total('Saldo', totals.saldo, totals.saldo < 0 ? theme.colors.expense : theme.colors.revenue)}
      {total('A receber', totals.aReceber, theme.colors.textSecondary)}
      {total('A pagar', totals.aPagar, theme.colors.textSecondary)}
      {total('Previsto', totals.previsto, totals.previsto < 0 ? theme.colors.expense : theme.colors.revenue)}
    </Totals>
  ) : null;

  const headerActions = (
    <Header>
      <Button variant="ghost" onClick={() => setShowTotals((prev) => !prev)}>
        {showTotals ? 'Ocultar totais' : 'Mostrar totais'}
      </Button>
    </Header>
  );

  return (
    <RecordListSurface
      vm={list}
      definition={list.definition}
      renderBelowHeader={renderBelowHeader}
      renderMetaRows={renderMetaRows}
      headerActions={headerActions}
      summary={summary}
      emptyTitle="Nenhum lançamento encontrado"
      emptyActionLabel="Cadastrar primeiro lançamento"
    />
  );
}
