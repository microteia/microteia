import styled from 'styled-components';

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
  `,

  TitleRow: styled.div`
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.sm};
    color: ${({ theme }) => theme.colors.primary};
    min-width: 0;
  `,

  Title: styled.h1`
    font-size: ${({ theme }) => theme.fontSizes.xl};
    font-weight: 700;
    color: ${({ theme }) => theme.colors.text};
  `,

  HeaderActions: styled.div`
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.sm};
    flex-shrink: 0;
  `,

  SaveBtn: styled.button`
    width: 30px;
    height: 30px;
    border-radius: ${({ theme }) => theme.borderRadius.md};
    border: 1px solid ${({ theme }) => theme.colors.border};
    background: ${({ theme }) => theme.colors.surface};
    color: ${({ theme }) => theme.colors.textMuted};
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: ${({ theme }) => theme.transitions.fast};
    flex-shrink: 0;

    &:hover:not(:disabled) {
      background: ${({ theme }) => theme.colors.success};
      color: ${({ theme }) => theme.colors.white};
      border-color: ${({ theme }) => theme.colors.success};
    }

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  `,

  DeleteBtn: styled.button`
    width: 30px;
    height: 30px;
    border-radius: ${({ theme }) => theme.borderRadius.md};
    border: 1px solid ${({ theme }) => theme.colors.border};
    background: ${({ theme }) => theme.colors.surface};
    color: ${({ theme }) => theme.colors.textMuted};
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: ${({ theme }) => theme.transitions.fast};
    flex-shrink: 0;

    &:hover:not(:disabled) {
      background: ${({ theme }) => theme.colors.danger};
      color: ${({ theme }) => theme.colors.white};
      border-color: ${({ theme }) => theme.colors.danger};
    }

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  `,

  ToggleIcon: styled.span<{ $enabled: boolean }>`
    display: inline-flex;
    color: ${({ $enabled, theme }) => ($enabled ? theme.colors.success : theme.colors.danger)};
  `,

  TabBar: styled.div`
    display: flex;
    border-bottom: 1px solid ${({ theme }) => theme.colors.border};
    flex-shrink: 0;
    padding: 0 ${({ theme }) => theme.spacing.xl};
  `,

  TabBtn: styled.button<{ $active: boolean }>`
    padding: ${({ theme }) => `${theme.spacing.md} ${theme.spacing.lg}`};
    font-size: ${({ theme }) => theme.fontSizes.sm};
    font-weight: 500;
    color: ${({ $active, theme }) => ($active ? theme.colors.primary : theme.colors.textSecondary)};
    border-bottom: 2px solid ${({ $active, theme }) => ($active ? theme.colors.primary : 'transparent')};
    transition: all ${({ theme }) => theme.transitions.fast};
    white-space: nowrap;

    &:hover { color: ${({ theme }) => theme.colors.text}; }
  `,

  Content: styled.div`
    flex: 1;
    overflow-y: auto;
    padding: ${({ theme }) => theme.spacing.xl};
    max-width: 720px;
  `,

  Form: styled.div`
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.lg};
  `,

  StepsToolbar: styled.div`
    display: flex;
    justify-content: flex-end;
    margin-bottom: ${({ theme }) => theme.spacing.md};
  `,

  StepRow: styled.div`
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.md};
    background: ${({ theme }) => theme.colors.surface};
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.borderRadius.lg};
    padding: ${({ theme }) => theme.spacing.md};
  `,

  StepOrder: styled.div`
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: ${({ theme }) => theme.colors.surfaceHover};
    color: ${({ theme }) => theme.colors.textMuted};
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: ${({ theme }) => theme.fontSizes.xs};
    font-weight: 600;
    flex-shrink: 0;
  `,

  StepIcon: styled.div`
    display: flex;
    align-items: center;
    justify-content: center;
    color: ${({ theme }) => theme.colors.textMuted};
    flex-shrink: 0;
  `,

  StepInfo: styled.div`
    flex: 1;
    min-width: 0;
  `,

  StepName: styled.div`
    font-size: ${({ theme }) => theme.fontSizes.sm};
    font-weight: 600;
    color: ${({ theme }) => theme.colors.text};
  `,

  StepDescription: styled.div`
    font-size: ${({ theme }) => theme.fontSizes.xs};
    color: ${({ theme }) => theme.colors.textMuted};
  `,

  StepActions: styled.div`
    display: flex;
    align-items: center;
    gap: 4px;
    flex-shrink: 0;
  `,

  IconBtn: styled.button`
    width: 28px;
    height: 28px;
    border-radius: ${({ theme }) => theme.borderRadius.md};
    border: 1px solid ${({ theme }) => theme.colors.border};
    background: ${({ theme }) => theme.colors.surface};
    color: ${({ theme }) => theme.colors.textMuted};
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: ${({ theme }) => theme.transitions.fast};

    &:hover:not(:disabled) { border-color: ${({ theme }) => theme.colors.primary}; color: ${({ theme }) => theme.colors.primary}; }
    &:disabled { opacity: 0.4; cursor: not-allowed; }
  `,

  List: styled.div`
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.sm};
  `,

  EmptyState: styled.div`
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: ${({ theme }) => theme.spacing.md};
    padding: ${({ theme }) => theme.spacing['2xl']};
    color: ${({ theme }) => theme.colors.textMuted};
    text-align: center;
  `,

  ExecutionRow: styled.details`
    background: ${({ theme }) => theme.colors.surface};
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.borderRadius.lg};
    padding: ${({ theme }) => theme.spacing.md};
  `,

  ExecutionSummary: styled.summary`
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.sm};
    cursor: pointer;
    font-size: ${({ theme }) => theme.fontSizes.sm};
    color: ${({ theme }) => theme.colors.text};
  `,

  StatusBadge: styled.span<{ $status: 'RUNNING' | 'SUCCESS' | 'FAILED' | 'PARTIAL' }>`
    display: inline-flex;
    padding: 2px 8px;
    border-radius: ${({ theme }) => theme.borderRadius.full};
    font-size: ${({ theme }) => theme.fontSizes.xs};
    font-weight: 600;
    background: ${({ $status, theme }) => (
    $status === 'SUCCESS' ? `${theme.colors.success}20` :
      $status === 'FAILED' ? `${theme.colors.danger}20` :
        `${theme.colors.warning}20`
  )};
    color: ${({ $status, theme }) => (
    $status === 'SUCCESS' ? theme.colors.success :
      $status === 'FAILED' ? theme.colors.danger :
        theme.colors.warning
  )};
  `,

  LogList: styled.div`
    margin-top: ${({ theme }) => theme.spacing.sm};
    padding-top: ${({ theme }) => theme.spacing.sm};
    border-top: 1px solid ${({ theme }) => theme.colors.border};
    display: flex;
    flex-direction: column;
    gap: 4px;
  `,

  LogEntry: styled.div<{ $level?: string }>`
    font-size: ${({ theme }) => theme.fontSizes.xs};
    font-family: ${({ theme }) => theme.fonts.mono};
    color: ${({ $level, theme }) => (
    $level === 'ERROR' ? theme.colors.danger :
      $level === 'SUCCESS' ? theme.colors.success :
        $level === 'WARN' ? theme.colors.warning :
          theme.colors.textMuted
  )};
  `,

  OutputsSection: styled.div`
    margin-top: ${({ theme }) => theme.spacing.sm};
    padding-top: ${({ theme }) => theme.spacing.sm};
    border-top: 1px solid ${({ theme }) => theme.colors.border};
  `,

  OutputsToggle: styled.button`
    background: none;
    border: none;
    color: ${({ theme }) => theme.colors.primary};
    cursor: pointer;
    font-size: ${({ theme }) => theme.fontSizes.sm};
    padding: ${({ theme }) => theme.spacing.xs} 0;
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.xs};
    transition: ${({ theme }) => theme.transitions.fast};

    &:hover {
      opacity: 0.8;
    }
  `,

  OutputsJson: styled.pre`
    margin: ${({ theme }) => theme.spacing.sm} 0 0 0;
    padding: ${({ theme }) => theme.spacing.md};
    background: ${({ theme }) => theme.colors.background};
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.borderRadius.md};
    font-size: ${({ theme }) => theme.fontSizes.xs};
    font-family: ${({ theme }) => theme.fonts.mono};
    color: ${({ theme }) => theme.colors.text};
    overflow-x: auto;
    max-height: 400px;
    overflow-y: auto;
  `,

  StepResultCard: styled.div`
    margin-top: ${({ theme }) => theme.spacing.md};
    padding: ${({ theme }) => theme.spacing.md};
    background: ${({ theme }) => theme.colors.surfaceHover};
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.borderRadius.md};
  `,

  StepResultHeader: styled.div`
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.sm};
    cursor: pointer;
    font-size: ${({ theme }) => theme.fontSizes.sm};
    font-weight: 600;
    color: ${({ theme }) => theme.colors.text};
    user-select: none;

    &:hover {
      color: ${({ theme }) => theme.colors.primary};
    }
  `,

  StepResultBody: styled.div`
    margin-top: ${({ theme }) => theme.spacing.sm};
    padding-top: ${({ theme }) => theme.spacing.sm};
    border-top: 1px solid ${({ theme }) => theme.colors.border};
  `,

  StepMessage: styled.div<{ $level?: string }>`
    font-size: ${({ theme }) => theme.fontSizes.xs};
    font-family: ${({ theme }) => theme.fonts.mono};
    margin-bottom: ${({ theme }) => theme.spacing.sm};
    color: ${({ $level, theme }) => (
      $level === 'ERROR' ? theme.colors.danger :
        $level === 'SUCCESS' ? theme.colors.success :
          $level === 'WARN' ? theme.colors.warning :
            theme.colors.textMuted
    )};
  `,

  DataSection: styled.div`
    margin-top: ${({ theme }) => theme.spacing.xs};
  `,

  DataToggle: styled.button`
    background: none;
    border: none;
    color: ${({ theme }) => theme.colors.textSecondary};
    cursor: pointer;
    font-size: ${({ theme }) => theme.fontSizes.xs};
    padding: ${({ theme }) => theme.spacing.xs} 0;
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.xs};
    transition: ${({ theme }) => theme.transitions.fast};

    &:hover {
      color: ${({ theme }) => theme.colors.primary};
    }
  `,

  DataJson: styled.pre`
    margin: ${({ theme }) => theme.spacing.xs} 0 0 0;
    padding: ${({ theme }) => theme.spacing.sm};
    background: ${({ theme }) => theme.colors.background};
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.borderRadius.sm};
    font-size: ${({ theme }) => theme.fontSizes.xs};
    font-family: ${({ theme }) => theme.fonts.mono};
    color: ${({ theme }) => theme.colors.text};
    overflow-x: auto;
    max-height: 300px;
    overflow-y: auto;
  `,

  GeneralOutputsSection: styled.div`
    margin-top: ${({ theme }) => theme.spacing.md};
    padding-top: ${({ theme }) => theme.spacing.md};
    border-top: 2px solid ${({ theme }) => theme.colors.border};
  `,
};
