import styled from 'styled-components';

type Gap = 'sm' | 'md' | 'lg';

export const S = {
  Stack: styled.div<{ $gap: Gap }>`
    display: flex;
    flex-direction: column;
    gap: ${({ theme, $gap }) => theme.spacing[$gap]};
  `,

  Grid: styled.div<{ $columns: number }>`
    display: grid;
    grid-template-columns: repeat(${({ $columns }) => $columns}, minmax(0, 1fr));
    gap: ${({ theme }) => theme.spacing.md};
  `,

  Heading: styled.h2`
    font-size: ${({ theme }) => theme.fontSizes.lg};
    font-weight: 700;
    color: ${({ theme }) => theme.colors.text};
  `,

  Text: styled.p<{ $muted: boolean }>`
    font-size: ${({ theme }) => theme.fontSizes.sm};
    line-height: 1.6;
    color: ${({ theme, $muted }) => ($muted ? theme.colors.textSecondary : theme.colors.text)};
  `,

  Metric: styled.div`
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.xs};
    padding: ${({ theme }) => theme.spacing.md};
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.borderRadius.md};
    background: ${({ theme }) => theme.colors.surface};
  `,

  MetricValue: styled.span`
    font-size: ${({ theme }) => theme.fontSizes.xl};
    font-weight: 700;
    color: ${({ theme }) => theme.colors.primary};
  `,

  MetricLabel: styled.span`
    font-size: ${({ theme }) => theme.fontSizes.xs};
    color: ${({ theme }) => theme.colors.textMuted};
    text-transform: uppercase;
    letter-spacing: 0.03em;
  `,

  KeyValue: styled.dl`
    display: grid;
    grid-template-columns: auto 1fr;
    gap: ${({ theme }) => theme.spacing.xs} ${({ theme }) => theme.spacing.md};
  `,

  KvKey: styled.dt`
    font-size: ${({ theme }) => theme.fontSizes.sm};
    font-weight: 600;
    color: ${({ theme }) => theme.colors.textSecondary};
  `,

  KvValue: styled.dd`
    font-size: ${({ theme }) => theme.fontSizes.sm};
    color: ${({ theme }) => theme.colors.text};
  `,

  Divider: styled.hr`
    border: none;
    border-top: 1px solid ${({ theme }) => theme.colors.border};
    margin: 0;
  `,

  Markdown: styled.div`
    font-size: ${({ theme }) => theme.fontSizes.sm};
    line-height: 1.6;
    color: ${({ theme }) => theme.colors.text};
  `,
};
