import styled from 'styled-components';
import type { FinancialType } from '../../../domain/entities';

export const S = {
  Page: styled.div`
    padding: ${({ theme }) => theme.spacing.xl};
    overflow-y: auto;
    height: 100%;
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.xl};
  `,

  Header: styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: ${({ theme }) => theme.spacing.md};
    flex-wrap: wrap;
  `,

  HeaderLeft: styled.div`
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.sm};

    svg { color: ${({ theme }) => theme.colors.primary}; }
  `,

  Title: styled.h1`
    font-size: ${({ theme }) => theme.fontSizes.xl};
    font-weight: 700;
    color: ${({ theme }) => theme.colors.text};
  `,

  Subtitle: styled.p`
    font-size: ${({ theme }) => theme.fontSizes.sm};
    color: ${({ theme }) => theme.colors.textMuted};
    margin: 2px 0 0;
  `,

  Toolbar: styled.div`
    display: flex;
    gap: ${({ theme }) => theme.spacing.sm};
    flex-wrap: wrap;
    align-items: center;
  `,

  KPIGrid: styled.div`
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: ${({ theme }) => theme.spacing.md};

    @media (max-width: 720px) {
      grid-template-columns: 1fr;
    }
  `,

  KPICard: styled.div<{ $color: string }>`
    background: ${({ theme }) => theme.colors.surface};
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-left: 3px solid ${({ $color }) => $color};
    border-radius: ${({ theme }) => theme.borderRadius.lg};
    padding: ${({ theme }) => theme.spacing.md};
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.xs};
  `,

  KPILabel: styled.div`
    font-size: ${({ theme }) => theme.fontSizes.xs};
    color: ${({ theme }) => theme.colors.textMuted};
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  `,

  KPIValue: styled.div<{ $color: string }>`
    font-size: ${({ theme }) => theme.fontSizes.lg};
    font-weight: 700;
    color: ${({ $color }) => $color};
    font-family: ${({ theme }) => theme.fonts.mono};
  `,

  ChartCard: styled.div`
    background: ${({ theme }) => theme.colors.surface};
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.borderRadius.lg};
    padding: ${({ theme }) => theme.spacing.lg};
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.md};
  `,

  ChartCardHeader: styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: ${({ theme }) => theme.spacing.md};
    flex-wrap: wrap;
  `,

  ChartTitle: styled.h3`
    font-size: ${({ theme }) => theme.fontSizes.xs};
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: ${({ theme }) => theme.colors.textSecondary};
    margin: 0;
  `,

  ModeGroup: styled.div`
    display: flex;
    gap: ${({ theme }) => theme.spacing.xs};
  `,

  ModeButton: styled.button<{ $active?: boolean; $type: FinancialType }>`
    background: ${({ $active, $type, theme }) => ($active ? ($type === 'Receita' ? theme.colors.revenue : theme.colors.expense) : theme.colors.surface)};
    border: 1px solid ${({ $active, $type, theme }) => ($active ? ($type === 'Receita' ? theme.colors.revenue : theme.colors.expense) : theme.colors.border)};
    border-radius: ${({ theme }) => theme.borderRadius.md};
    padding: ${({ theme }) => theme.spacing.xs} ${({ theme }) => theme.spacing.md};
    font-size: ${({ theme }) => theme.fontSizes.sm};
    font-weight: 500;
    color: ${({ $active, theme }) => ($active ? theme.colors.white : theme.colors.textSecondary)};
    cursor: pointer;
    transition: ${({ theme }) => theme.transitions.fast};

    &:hover {
      border-color: ${({ $type, theme }) => ($type === 'Receita' ? theme.colors.revenue : theme.colors.expense)};
    }
  `,

  ChartsGrid: styled.div`
    display: grid;
    grid-template-columns: 1.5fr 1fr;
    gap: ${({ theme }) => theme.spacing.lg};

    @media (max-width: 1200px) {
      grid-template-columns: 1fr;
    }
  `,

  ChartsRow: styled.div`
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: ${({ theme }) => theme.spacing.lg};

    @media (max-width: 900px) {
      grid-template-columns: 1fr;
    }
  `,

  ChartWrapper: styled.div`
    width: 100%;
    height: 280px;
  `,

  TypeChipsContainer: styled.div`
    display: flex;
    flex-wrap: wrap;
    gap: ${({ theme }) => theme.spacing.xs};
  `,

  TotalText: styled.div`
    text-align: center;
    font-size: ${({ theme }) => theme.fontSizes.sm};
    color: ${({ theme }) => theme.colors.textSecondary};
  `,

  LegendList: styled.div`
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.sm};
    max-height: 140px;
    overflow-y: auto;
  `,

  LegendItem: styled.div`
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.sm};
  `,

  LegendDot: styled.div<{ $color: string }>`
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: ${({ $color }) => $color};
    flex-shrink: 0;
  `,

  LegendName: styled.div`
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: ${({ theme }) => theme.fontSizes.sm};
    color: ${({ theme }) => theme.colors.text};
  `,

  LegendValue: styled.div`
    font-size: ${({ theme }) => theme.fontSizes.xs};
    font-weight: 600;
    font-family: ${({ theme }) => theme.fonts.mono};
    color: ${({ theme }) => theme.colors.textSecondary};
    flex-shrink: 0;
  `,

  LegendPercent: styled.div`
    font-size: ${({ theme }) => theme.fontSizes.sm};
    font-weight: 600;
    color: ${({ theme }) => theme.colors.text};
    flex-shrink: 0;
    width: 36px;
    text-align: right;
  `,

  EmptyState: styled.div`
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: ${({ theme }) => theme.spacing.sm};
    height: 240px;
    color: ${({ theme }) => theme.colors.textMuted};
    font-size: ${({ theme }) => theme.fontSizes.sm};
    text-align: center;
  `,

  PageEmptyState: styled.div`
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: ${({ theme }) => theme.spacing.md};
    flex: 1;
    color: ${({ theme }) => theme.colors.textMuted};
    text-align: center;

    svg { font-size: 48px; opacity: 0.3; }
  `,
};
