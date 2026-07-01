import styled from 'styled-components';

export const S = {
  Container: styled.div`
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.lg};
    margin-bottom: ${({ theme }) => theme.spacing.xl};
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
    gap: ${({ theme }) => theme.spacing.md};
  `,

  Title: styled.h2`
    font-size: ${({ theme }) => theme.fontSizes.lg};
    font-weight: 600;
    color: ${({ theme }) => theme.colors.text};
    margin: 0;
  `,

  Controls: styled.div`
    display: flex;
    gap: ${({ theme }) => theme.spacing.sm};
    align-items: center;
    flex-wrap: wrap;
  `,

  ModeButton: styled.button<{ $active?: boolean }>`
    background: ${({ $active, theme }) =>
      $active ? theme.colors.primary : theme.colors.surface};
    border: 1px solid
      ${({ $active, theme }) => ($active ? theme.colors.primary : theme.colors.border)};
    border-radius: ${({ theme }) => theme.borderRadius.md};
    padding: ${({ theme }) => theme.spacing.xs} ${({ theme }) => theme.spacing.md};
    font-size: ${({ theme }) => theme.fontSizes.sm};
    font-weight: 500;
    color: ${({ $active, theme }) => ($active ? '#fff' : theme.colors.textSecondary)};
    cursor: pointer;
    transition: all 0.2s;

    &:hover {
      background: ${({ $active, theme }) =>
        $active ? theme.colors.primaryHover : theme.colors.surfaceHover};
      border-color: ${({ theme }) => theme.colors.primary};
    }
  `,

  PeriodGroup: styled.div`
    display: flex;
    gap: ${({ theme }) => theme.spacing.xs};
    background: ${({ theme }) => theme.colors.surface};
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.borderRadius.md};
    padding: 2px;
  `,

  PeriodButton: styled.button<{ $active?: boolean }>`
    background: ${({ $active, theme }) =>
      $active ? theme.colors.primary : 'transparent'};
    border: none;
    border-radius: ${({ theme }) => theme.borderRadius.sm};
    padding: ${({ theme }) => theme.spacing.xs} ${({ theme }) => theme.spacing.sm};
    font-size: ${({ theme }) => theme.fontSizes.sm};
    font-weight: 500;
    color: ${({ $active, theme }) => ($active ? '#fff' : theme.colors.textSecondary)};
    cursor: pointer;
    transition: all 0.2s;
    min-width: 40px;

    &:hover {
      background: ${({ $active, theme }) =>
        $active ? theme.colors.primaryHover : theme.colors.surfaceHover};
    }
  `,

  ToggleButton: styled.button`
    background: ${({ theme }) => theme.colors.surface};
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.borderRadius.md};
    padding: ${({ theme }) => theme.spacing.xs} ${({ theme }) => theme.spacing.sm};
    font-size: ${({ theme }) => theme.fontSizes.sm};
    font-weight: 500;
    color: ${({ theme }) => theme.colors.textSecondary};
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.xs};
    transition: all 0.2s;

    &:hover {
      background: ${({ theme }) => theme.colors.surfaceHover};
      color: ${({ theme }) => theme.colors.text};
      border-color: ${({ theme }) => theme.colors.primary};
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

  ChartCard: styled.div`
    background: ${({ theme }) => theme.colors.surface};
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.borderRadius.lg};
    padding: ${({ theme }) => theme.spacing.lg};
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.md};
  `,

  ChartTitle: styled.h3`
    font-size: ${({ theme }) => theme.fontSizes.md};
    font-weight: 600;
    color: ${({ theme }) => theme.colors.text};
    margin: 0;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    font-size: ${({ theme }) => theme.fontSizes.xs};
    color: ${({ theme }) => theme.colors.textSecondary};
  `,

  TypeChipsContainer: styled.div`
    display: flex;
    flex-wrap: wrap;
    gap: ${({ theme }) => theme.spacing.xs};
  `,

  TypeChip: styled.button<{ $color: string; $active: boolean }>`
    background: ${({ $active, $color }) => ($active ? $color : 'transparent')};
    border: 1px solid ${({ $color }) => $color};
    border-radius: ${({ theme }) => theme.borderRadius.full};
    padding: ${({ theme }) => theme.spacing.xs} ${({ theme }) => theme.spacing.sm};
    font-size: ${({ theme }) => theme.fontSizes.xs};
    font-weight: 500;
    color: ${({ $active }) => ($active ? '#fff' : 'inherit')};
    cursor: pointer;
    transition: all 0.2s;
    opacity: ${({ $active }) => ($active ? 1 : 0.5)};

    &:hover {
      opacity: 1;
      background: ${({ $color }) => $color};
      color: #fff;
    }
  `,

  ChartWrapper: styled.div`
    width: 100%;
    height: 300px;
    display: flex;
    align-items: center;
    justify-content: center;
  `,

  TotalText: styled.div`
    text-align: center;
    font-size: ${({ theme }) => theme.fontSizes.sm};
    color: ${({ theme }) => theme.colors.textSecondary};
    margin-top: ${({ theme }) => theme.spacing.sm};
  `,

  LegendList: styled.div`
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.sm};
    margin-top: ${({ theme }) => theme.spacing.sm};
  `,

  LegendItem: styled.div`
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.sm};
  `,

  LegendDot: styled.div<{ $color: string }>`
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: ${({ $color }) => $color};
    flex-shrink: 0;
  `,

  LegendName: styled.div`
    flex: 1;
    font-size: ${({ theme }) => theme.fontSizes.sm};
    color: ${({ theme }) => theme.colors.text};
  `,

  LegendPercent: styled.div`
    font-size: ${({ theme }) => theme.fontSizes.sm};
    font-weight: 600;
    color: ${({ theme }) => theme.colors.text};
  `,

  EmptyState: styled.div`
    display: flex;
    align-items: center;
    justify-content: center;
    height: 200px;
    color: ${({ theme }) => theme.colors.textSecondary};
    font-size: ${({ theme }) => theme.fontSizes.sm};
  `,
};
