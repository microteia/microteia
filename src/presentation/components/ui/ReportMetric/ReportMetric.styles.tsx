import styled from 'styled-components';
import type { ReportMetricTrend } from './ReportMetric.viewmodel';

export const S = {
  Metric: styled.div`
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.xs};
    padding: ${({ theme }) => theme.spacing.md};
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.borderRadius.md};
    background: ${({ theme }) => theme.colors.surface};
  `,
  Value: styled.span<{ $muted: boolean }>`
    font-size: ${({ theme }) => theme.fontSizes.xl};
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    color: ${({ theme, $muted }) => ($muted ? theme.colors.textMuted : theme.colors.primary)};
  `,
  Label: styled.span`
    font-size: ${({ theme }) => theme.fontSizes.xs};
    color: ${({ theme }) => theme.colors.textMuted};
    text-transform: uppercase;
    letter-spacing: 0.03em;
  `,
  /**
   * A cor segue a DIREÇÃO, na convenção de painel — e o sinal vai junto no texto, porque numa medida de
   * custo subir é a má notícia, e só quem lê sabe qual das duas a medida é.
   */
  Delta: styled.span<{ $trend: ReportMetricTrend }>`
    font-size: ${({ theme }) => theme.fontSizes.xs};
    font-variant-numeric: tabular-nums;
    color: ${({ theme, $trend }) => ($trend === 'up' ? theme.colors.success : $trend === 'down' ? theme.colors.danger : theme.colors.textMuted)};
  `,
  Error: styled.span`
    font-size: ${({ theme }) => theme.fontSizes.xs};
    color: ${({ theme }) => theme.colors.warning};
  `,
};
