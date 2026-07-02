import styled from 'styled-components';
import type { FinancialType } from '../../../domain/entities';

export const S = {
  Page: styled.div`
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
  `,

  Header: styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: ${({ theme }) => theme.spacing.lg} ${({ theme }) => theme.spacing.xl};
    border-bottom: 1px solid ${({ theme }) => theme.colors.border};
    flex-shrink: 0;
    gap: ${({ theme }) => theme.spacing.md};
    flex-wrap: wrap;
  `,

  HeaderLeft: styled.div`
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.md};
  `,

  Avatar: styled.div<{ $type: FinancialType }>`
    width: 48px;
    height: 48px;
    border-radius: ${({ theme }) => theme.borderRadius.full};
    background: ${({ theme, $type }) => $type === 'Receita' ? theme.colors.success : theme.colors.danger};
    display: flex;
    align-items: center;
    justify-content: center;
    color: ${({ theme }) => theme.colors.white};
    font-size: ${({ theme }) => theme.fontSizes.xl};
    font-weight: 700;
    flex-shrink: 0;
  `,

  HeaderInfo: styled.div`
    display: flex;
    flex-direction: column;
    gap: 2px;
  `,

  Title: styled.h1`
    font-size: ${({ theme }) => theme.fontSizes.xl};
    font-weight: 700;
    color: ${({ theme }) => theme.colors.text};
  `,

  SubTitle: styled.div<{ $type?: FinancialType }>`
    font-size: ${({ theme }) => theme.fontSizes.sm};
    color: ${({ theme, $type }) => $type === 'Receita' ? theme.colors.success : $type === 'Despesa' ? theme.colors.danger : theme.colors.textMuted};
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.xs};
    font-family: ${({ theme }) => theme.fonts.mono};
    font-weight: 600;
  `,

  HeaderActions: styled.div`
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.sm};
    flex-wrap: wrap;
  `,

  Content: styled.div`
    flex: 1;
    overflow-y: auto;
    padding: ${({ theme }) => theme.spacing.xl};
  `,

  FormGrid: styled.div`
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: ${({ theme }) => theme.spacing.md};
    max-width: 900px;

    @media (max-width: 640px) {
      grid-template-columns: 1fr;
    }
  `,

  FormGroup: styled.div<{ $fullWidth?: boolean }>`
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.xs};
    grid-column: ${({ $fullWidth }) => $fullWidth ? '1 / -1' : 'auto'};
  `,

  SectionTitle: styled.h3`
    font-size: ${({ theme }) => theme.fontSizes.md};
    font-weight: 600;
    color: ${({ theme }) => theme.colors.text};
    margin: ${({ theme }) => theme.spacing.lg} 0 ${({ theme }) => theme.spacing.sm};
    padding-bottom: ${({ theme }) => theme.spacing.xs};
    border-bottom: 1px solid ${({ theme }) => theme.colors.border};
    grid-column: 1 / -1;

    &:first-child { margin-top: 0; }
  `,

  FormActions: styled.div`
    display: flex;
    gap: ${({ theme }) => theme.spacing.sm};
    justify-content: flex-end;
    margin-top: ${({ theme }) => theme.spacing.lg};
    grid-column: 1 / -1;
  `,

  TypeToggle: styled.div`
    display: flex;
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.borderRadius.md};
    overflow: hidden;
    width: fit-content;
  `,

  TypeOption: styled.button<{ $active: boolean; $income?: boolean }>`
    padding: 9px 18px;
    font-size: ${({ theme }) => theme.fontSizes.sm};
    font-weight: 600;
    background: ${({ $active, $income, theme }) =>
      $active
        ? $income
          ? theme.colors.success
          : theme.colors.danger
        : 'transparent'};
    color: ${({ $active, theme }) => $active ? theme.colors.white : theme.colors.textSecondary};
    transition: all ${({ theme }) => theme.transitions.fast};

    &:not(:last-child) { border-right: 1px solid ${({ theme }) => theme.colors.border}; }
  `,
};
