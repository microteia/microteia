import styled from 'styled-components';
import type { ReportHighlightTone } from '../../../../domain/schema/report/reportSpec';
import { reportToneBackground } from '../../../shared/report/reportTone';

export const S = {
  Scroll: styled.div`
    overflow-x: auto;
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.borderRadius.md};
    background: ${({ theme }) => theme.colors.surface};
  `,
  Table: styled.table`
    width: 100%;
    border-collapse: collapse;
    font-size: ${({ theme }) => theme.fontSizes.sm};
    color: ${({ theme }) => theme.colors.text};
  `,
  Head: styled.thead`
    background: ${({ theme }) => theme.colors.inputBackground};
  `,
  Th: styled.th<{ $numeric?: boolean }>`
    text-align: ${({ $numeric }) => ($numeric ? 'right' : 'left')};
    font-size: ${({ theme }) => theme.fontSizes.xs};
    font-weight: 600;
    color: ${({ theme }) => theme.colors.textSecondary};
    padding: 10px 14px;
    border-bottom: 1px solid ${({ theme }) => theme.colors.border};
    white-space: nowrap;
  `,
  Row: styled.tr<{ $subtotal?: boolean; $band?: boolean }>`
    background: ${({ theme, $subtotal, $band }) =>
    ($subtotal || $band ? theme.colors.inputBackground : 'transparent')};
    /* A faixa que ABRE um grupo é a única linha com traço acima: é ela que separa um grupo do
       anterior, e sem isso a lista agrupada vira uma lista corrida com títulos no meio. */
    border-top: ${({ theme, $band }) => ($band ? `2px solid ${theme.colors.border}` : 'none')};

    &:hover {
      background: ${({ theme }) => theme.colors.surfaceHover};
    }
  `,
  Td: styled.td<{ $numeric?: boolean; $level?: number; $strong?: boolean; $tone?: ReportHighlightTone; $clickable?: boolean }>`
    text-align: ${({ $numeric }) => ($numeric ? 'right' : 'left')};
    padding: 9px 14px;
    padding-left: ${({ $level, $numeric }) => ($numeric ? 14 : 14 + (($level ?? 0) * 18))}px;
    border-bottom: 1px solid ${({ theme }) => theme.colors.borderSubtle};
    font-weight: ${({ $strong }) => ($strong ? 600 : 400)};
    font-variant-numeric: tabular-nums;
    background: ${({ theme, $tone }) => reportToneBackground(theme, $tone)};
      cursor: ${({ $clickable }) => ($clickable ? 'pointer' : 'default')};
    text-decoration: ${({ $clickable }) => ($clickable ? 'underline dotted' : 'none')};
`,
  TotalRow: styled.tr`
    background: ${({ theme }) => theme.colors.inputBackground};
  `,
  TotalTd: styled.td<{ $numeric?: boolean; $tone?: ReportHighlightTone }>`
    text-align: ${({ $numeric }) => ($numeric ? 'right' : 'left')};
    padding: 11px 14px;
    border-top: 2px solid ${({ theme }) => theme.colors.border};
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    background: ${({ theme, $tone }) => reportToneBackground(theme, $tone)};
  `,
  Empty: styled.p`
    margin: 0;
    padding: 28px 14px;
    text-align: center;
    font-size: ${({ theme }) => theme.fontSizes.sm};
    color: ${({ theme }) => theme.colors.textMuted};
  `,
};
