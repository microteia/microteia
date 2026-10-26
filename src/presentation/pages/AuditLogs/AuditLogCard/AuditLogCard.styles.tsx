import styled from 'styled-components';
import type { DefaultTheme } from 'styled-components';
import type { AuditSeverity, AuditAction } from '../../../../domain/entities';

export const severityColor = (theme: DefaultTheme, severity: AuditSeverity): string => {
  if (severity === 'CRITICAL') return theme.colors.danger;
  if (severity === 'HIGH') return theme.colors.warning;
  return theme.colors.info;
};

export const actionColor = (theme: DefaultTheme, action: AuditAction): string => {
  if (action === 'CREATE') return theme.colors.success;
  if (action === 'UPDATE') return theme.colors.info;
  if (action === 'DELETE') return theme.colors.danger;
  return theme.colors.warning;
};

export const S = {
  Hash: styled.code`
    display: block;
    font-family: ${({ theme }) => theme.fonts.mono};
    font-size: ${({ theme }) => theme.fontSizes.xs};
    color: ${({ theme }) => theme.colors.textMuted};
    word-break: break-all;
  `,

  Row: styled.div`
    border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  `,

  RowHeader: styled.button`
    display: flex;
    align-items: center;
    gap: 6px;
    width: 100%;
    padding: 3px ${({ theme }) => theme.spacing.sm};
    background: none;
    border: none;
    cursor: pointer;
    text-align: left;
    font: inherit;
    color: inherit;
    line-height: 1.3;

    &:hover {
      background: ${({ theme }) => theme.colors.surfaceHover};
    }
  `,

  Chevron: styled.span<{ $expanded: boolean }>`
    display: flex;
    flex-shrink: 0;
    align-items: center;
    color: ${({ theme }) => theme.colors.textMuted};
    transform: rotate(${({ $expanded }) => ($expanded ? '90deg' : '0deg')});
    transition: transform ${({ theme }) => theme.transitions.fast};
  `,

  SeverityIcon: styled.span<{ $severity: AuditSeverity }>`
    display: flex;
    flex-shrink: 0;
    align-items: center;
    color: ${({ theme, $severity }) => severityColor(theme, $severity)};
  `,

  Time: styled.span`
    flex-shrink: 0;
    width: 178px;
    white-space: nowrap;
    font-family: ${({ theme }) => theme.fonts.mono};
    font-size: ${({ theme }) => theme.fontSizes.xs};
    color: ${({ theme }) => theme.colors.textSecondary};
  `,

  Summary: styled.span`
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 6px;
    overflow: hidden;
  `,

  SummaryText: styled.span`
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: ${({ theme }) => theme.fontSizes.xs};
    color: ${({ theme }) => theme.colors.text};
  `,

  Chip: styled.span`
    flex-shrink: 0;
    padding: 0 6px;
    border-radius: ${({ theme }) => theme.borderRadius.sm};
    background: ${({ theme }) => theme.colors.background};
    border: 1px solid ${({ theme }) => theme.colors.border};
    font-size: ${({ theme }) => theme.fontSizes.xs};
    color: ${({ theme }) => theme.colors.textSecondary};
    white-space: nowrap;
    line-height: 1.6;
  `,

  ActionChip: styled.span<{ $color: string }>`
    flex-shrink: 0;
    padding: 0 6px;
    border-radius: ${({ theme }) => theme.borderRadius.sm};
    background: ${({ theme }) => theme.colors.background};
    border: 1px solid ${({ $color }) => $color};
    font-size: ${({ theme }) => theme.fontSizes.xs};
    color: ${({ $color }) => $color};
    white-space: nowrap;
    line-height: 1.6;
  `,

  Details: styled.div`
    padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.spacing.md} 62px;
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.sm};
  `,

  DetailsMeta: styled.div`
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
  `,

  UserName: styled.span`
    font-size: ${({ theme }) => theme.fontSizes.xs};
    color: ${({ theme }) => theme.colors.textMuted};
  `,

  Body: styled.div`
    font-size: ${({ theme }) => theme.fontSizes.sm};
    color: ${({ theme }) => theme.colors.text};

    p { margin: 0 0 4px 0; }
    pre {
      background: ${({ theme }) => theme.colors.background};
      border: 1px solid ${({ theme }) => theme.colors.border};
      border-radius: ${({ theme }) => theme.borderRadius.md};
      padding: ${({ theme }) => theme.spacing.sm};
      overflow-x: auto;
      font-size: ${({ theme }) => theme.fontSizes.xs};
    }
    code {
      font-family: ${({ theme }) => theme.fonts.mono};
    }
  `,

  LinkButton: styled.button`
    align-self: flex-start;
    background: none;
    border: none;
    padding: 0;
    color: ${({ theme }) => theme.colors.primary};
    font-size: ${({ theme }) => theme.fontSizes.xs};
    font-weight: 600;
    cursor: pointer;

    &:hover {
      text-decoration: underline;
    }
  `,
};
