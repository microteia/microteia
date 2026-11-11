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
  CornerTh: styled.th`
    text-align: left;
    font-size: ${({ theme }) => theme.fontSizes.xs};
    font-weight: 600;
    color: ${({ theme }) => theme.colors.textSecondary};
    padding: 10px 14px;
    border-bottom: 1px solid ${({ theme }) => theme.colors.border};
    border-right: 1px solid ${({ theme }) => theme.colors.border};
    white-space: nowrap;
    position: sticky;
    left: 0;
    background: ${({ theme }) => theme.colors.inputBackground};
  `,
  ColumnTh: styled.th<{ $span?: number }>`
    text-align: right;
    font-size: ${({ theme }) => theme.fontSizes.xs};
    font-weight: 600;
    color: ${({ theme }) => theme.colors.textSecondary};
    padding: 10px 14px;
    border-bottom: 1px solid ${({ theme }) => theme.colors.border};
    white-space: nowrap;
  `,
  MeasureTh: styled.th`
    text-align: right;
    font-size: ${({ theme }) => theme.fontSizes.xs};
    font-weight: 500;
    color: ${({ theme }) => theme.colors.textMuted};
    padding: 6px 14px;
    border-bottom: 1px solid ${({ theme }) => theme.colors.border};
    white-space: nowrap;
  `,
  Row: styled.tr<{ $subtotal?: boolean }>`
    background: ${({ theme, $subtotal }) => ($subtotal ? theme.colors.inputBackground : 'transparent')};

    &:hover {
      background: ${({ theme }) => theme.colors.surfaceHover};
    }
  `,
  RowTh: styled.th<{ $level?: number; $strong?: boolean }>`
    text-align: left;
    font-weight: ${({ $strong }) => ($strong ? 600 : 400)};
    padding: 9px 14px;
    padding-left: ${({ $level }) => 14 + (($level ?? 0) * 18)}px;
    border-bottom: 1px solid ${({ theme }) => theme.colors.borderSubtle};
    border-right: 1px solid ${({ theme }) => theme.colors.border};
    white-space: nowrap;
    position: sticky;
    left: 0;
    background: inherit;
  `,
  Td: styled.td<{ $strong?: boolean; $tone?: ReportHighlightTone }>`
    text-align: right;
    padding: 9px 14px;
    border-bottom: 1px solid ${({ theme }) => theme.colors.borderSubtle};
    font-weight: ${({ $strong }) => ($strong ? 600 : 400)};
    font-variant-numeric: tabular-nums;
    background: ${({ theme, $tone }) => reportToneBackground(theme, $tone)};
  `,
  TotalRow: styled.tr`
    background: ${({ theme }) => theme.colors.inputBackground};
  `,
  TotalTh: styled.th`
    text-align: left;
    padding: 11px 14px;
    border-top: 2px solid ${({ theme }) => theme.colors.border};
    border-right: 1px solid ${({ theme }) => theme.colors.border};
    font-weight: 700;
    white-space: nowrap;
    position: sticky;
    left: 0;
    background: ${({ theme }) => theme.colors.inputBackground};
  `,
  TotalTd: styled.td<{ $tone?: ReportHighlightTone }>`
    text-align: right;
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
