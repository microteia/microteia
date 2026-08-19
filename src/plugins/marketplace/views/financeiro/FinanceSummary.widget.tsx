import { useMemo, useState } from 'react';
import { styled, useTheme } from 'styled-components';
import { Button } from '@microteia/ui';
import { useCollection, useOpenScreenList } from '@microteia/data';
import { formatCurrencyBRL } from '@microteia/format';

const Card = styled.div`
  background: ${({ theme }) => theme.colors.surface};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.borderRadius.lg};
  padding: ${({ theme }) => theme.spacing.lg};
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.md};
  height: 100%;
`;

const Head = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing.sm};
  flex-wrap: wrap;
`;

const Title = styled.h3`
  font-size: ${({ theme }) => theme.fontSizes.md};
  font-weight: 600;
  color: ${({ theme }) => theme.colors.text};
`;

const Periods = styled.div`
  display: flex;
  gap: 2px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  padding: 2px;
`;

const Period = styled.button`
  border: none;
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  padding: ${({ theme }) => theme.spacing.xs} ${({ theme }) => theme.spacing.sm};
  font-size: ${({ theme }) => theme.fontSizes.xs};
  font-weight: 600;
  cursor: pointer;
  background: ${({ $active, theme }) => ($active ? theme.colors.primary : 'transparent')};
  color: ${({ $active, theme }) => ($active ? theme.colors.white : theme.colors.textSecondary)};
`;

const Row = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${({ theme }) => theme.spacing.sm} 0;
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  &:last-child { border-bottom: none; }
`;

const RowLabel = styled.span`
  font-size: ${({ theme }) => theme.fontSizes.sm};
  color: ${({ theme }) => theme.colors.textMuted};
`;

const RowValue = styled.span`
  font-size: ${({ theme }) => theme.fontSizes.md};
  font-weight: 700;
  font-family: ${({ theme }) => theme.fonts.mono};
  color: ${({ $color }) => $color};
`;

const PERIODS = [7, 15, 30];
const DAY = 86400000;

const dayTime = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (isNaN(date.getTime())) return null;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
};

const isoOf = (time) => {
  const date = new Date(time);
  const pad = (n) => String(n).padStart(2, '0');
  return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate());
};

export default function FinanceiroResumoWidget() {
  const theme = useTheme();
  const financials = useCollection('financials');
  const openList = useOpenScreenList();
  const [days, setDays] = useState(30);

  const totals = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const limit = today + days * DAY;
    const open = financials.filter((f) => {
      const due = dayTime(f.dueDate);
      return f.status === 'Aberto' && due !== null && due <= limit;
    });
    const sum = (type) => open
      .filter((f) => f.type === type)
      .reduce((total, f) => total + (Number(f.amount) || 0), 0);
    const receber = sum('Receita');
    const pagar = sum('Despesa');
    return { receber, pagar, saldo: receber - pagar, limit };
  }, [financials, days]);

  return (
    <Card>
      <Head>
        <Title>Financeiro</Title>
        <Head>
          <Periods>
            {PERIODS.map((option) => (
              <Period key={option} $active={days === option} onClick={() => setDays(option)}>{option}d</Period>
            ))}
          </Periods>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => openList('financials', [
              { key: 'status', values: ['Aberto'] },
              { key: 'dueDate:ate', values: [isoOf(totals.limit)] },
            ])}
          >
            Ver tudo
          </Button>
        </Head>
      </Head>
      <div>
        <Row>
          <RowLabel>Receitas a receber</RowLabel>
          <RowValue $color={theme.colors.revenue}>{formatCurrencyBRL(totals.receber)}</RowValue>
        </Row>
        <Row>
          <RowLabel>Despesas a pagar</RowLabel>
          <RowValue $color={theme.colors.expense}>{formatCurrencyBRL(totals.pagar)}</RowValue>
        </Row>
        <Row>
          <RowLabel>Saldo projetado</RowLabel>
          <RowValue $color={totals.saldo >= 0 ? theme.colors.revenue : theme.colors.expense}>
            {formatCurrencyBRL(totals.saldo)}
          </RowValue>
        </Row>
      </div>
    </Card>
  );
}
