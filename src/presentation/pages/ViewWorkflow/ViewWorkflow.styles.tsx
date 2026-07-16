import styled from 'styled-components';

const NodeActions = styled.div`
  position: absolute;
  top: 50%;
  right: ${({ theme }) => theme.spacing.sm};
  transform: translateY(-50%);
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px;
  border-radius: ${({ theme }) => theme.borderRadius.md};
  background: ${({ theme }) => theme.colors.surface};
  box-shadow: 0 2px 8px ${({ theme }) => theme.colors.shadow};
  opacity: 0;
  pointer-events: none;
  transition: opacity ${({ theme }) => theme.transitions.fast};
`;

const FlowNode = styled.div<{ $disabled?: boolean; $dragging?: boolean }>`
  position: relative;
  width: 100%;
  max-width: 520px;
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  background: ${({ theme }) => theme.colors.surface};
  border: 1px ${({ $disabled }) => ($disabled ? 'dashed' : 'solid')} ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.borderRadius.lg};
  padding: ${({ theme }) => theme.spacing.md};
  cursor: grab;
  opacity: ${({ $dragging, $disabled }) => ($dragging ? 0.4 : $disabled ? 0.65 : 1)};
  transition: border-color ${({ theme }) => theme.transitions.fast}, box-shadow ${({ theme }) => theme.transitions.fast};

  &:hover {
    border-color: ${({ theme }) => theme.colors.primary};
    box-shadow: 0 2px 8px ${({ theme }) => theme.colors.shadow};
  }

  &:hover ${NodeActions}, &:focus-within ${NodeActions} {
    opacity: 1;
    pointer-events: auto;
  }
`;

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

  CopyBadge: styled.div<{ $outdated: boolean }>`
    display: flex;
    align-items: center;
    padding: 4px 10px;
    border-radius: ${({ theme }) => theme.borderRadius.sm};
    background: ${({ $outdated, theme }) => ($outdated ? `${theme.colors.warning}15` : `${theme.colors.info}15`)};
    border: 1px solid ${({ $outdated, theme }) => ($outdated ? theme.colors.warning : theme.colors.info)};
    color: ${({ $outdated, theme }) => ($outdated ? theme.colors.warning : theme.colors.info)};
    font-size: ${({ theme }) => theme.fontSizes.xs};
    font-weight: 500;
    white-space: nowrap;
  `,

  OutdatedBadge: styled.div`
    display: flex;
    align-items: center;
    padding: 4px 10px;
    border-radius: ${({ theme }) => theme.borderRadius.sm};
    background: ${({ theme }) => theme.colors.warning}15;
    border: 1px solid ${({ theme }) => theme.colors.warning};
    color: ${({ theme }) => theme.colors.warning};
    font-size: ${({ theme }) => theme.fontSizes.xs};
    font-weight: 500;
    white-space: nowrap;
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
  `,

  ContentInner: styled.div`
    max-width: 720px;
  `,

  StepsContentInner: styled.div`
    max-width: 1100px;
    margin: 0 auto;
  `,

  Form: styled.div`
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.lg};
  `,

  StepsToolbar: styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: ${({ theme }) => theme.spacing.md};
  `,

  ViewToggle: styled.div`
    display: inline-flex;
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.borderRadius.md};
    overflow: hidden;
  `,

  ViewToggleBtn: styled.button<{ $active: boolean }>`
    width: 34px;
    height: 30px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: ${({ $active, theme }) => ($active ? theme.colors.primaryLight : theme.colors.surface)};
    color: ${({ $active, theme }) => ($active ? theme.colors.primary : theme.colors.textMuted)};
    cursor: pointer;
    transition: ${({ theme }) => theme.transitions.fast};

    & + & {
      border-left: 1px solid ${({ theme }) => theme.colors.border};
    }

    &:hover {
      color: ${({ theme }) => theme.colors.primary};
    }
  `,

  FlowCanvas: styled.div`
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: ${({ theme }) => theme.spacing.md} 0 ${({ theme }) => theme.spacing['2xl']};
  `,

  TriggerNode: styled.div`
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.sm};
    padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md};
    background: ${({ theme }) => theme.colors.primaryLight};
    border: 1px solid ${({ theme }) => theme.colors.primary};
    border-radius: ${({ theme }) => theme.borderRadius.lg};
    color: ${({ theme }) => theme.colors.primary};
  `,

  TriggerText: styled.div`
    display: flex;
    flex-direction: column;
    min-width: 0;
  `,

  TriggerKicker: styled.span`
    font-size: ${({ theme }) => theme.fontSizes.xs};
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: ${({ theme }) => theme.colors.primary};
  `,

  TriggerLabel: styled.span`
    font-size: ${({ theme }) => theme.fontSizes.sm};
    font-weight: 600;
    color: ${({ theme }) => theme.colors.text};
  `,

  FlowConnector: styled.div<{ $active?: boolean; $dashed?: boolean }>`
    width: 48px;
    height: 28px;
    display: flex;
    justify-content: center;
    flex-shrink: 0;

    &::after {
      content: '';
      border-left: 2px ${({ $dashed }) => ($dashed ? 'dashed' : 'solid')}
        ${({ $active, theme }) => ($active ? theme.colors.primary : theme.colors.border)};
    }
  `,

  FlowNode,
  NodeActions,

  NodeIconBox: styled.div`
    width: 36px;
    height: 36px;
    border-radius: ${({ theme }) => theme.borderRadius.md};
    background: ${({ theme }) => theme.colors.primaryLight};
    color: ${({ theme }) => theme.colors.primary};
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  `,

  NodeBody: styled.div`
    flex: 1;
    min-width: 0;
  `,

  NodeTitle: styled.div`
    font-size: ${({ theme }) => theme.fontSizes.sm};
    font-weight: 600;
    color: ${({ theme }) => theme.colors.text};
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  `,

  NodeType: styled.div`
    font-size: ${({ theme }) => theme.fontSizes.xs};
    color: ${({ theme }) => theme.colors.textMuted};
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  `,

  NodeStatusDot: styled.span<{ $enabled: boolean }>`
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: ${({ $enabled, theme }) => ($enabled ? theme.colors.success : theme.colors.danger)};
    flex-shrink: 0;
  `,

  DragHandle: styled.span`
    display: flex;
    align-items: center;
    color: ${({ theme }) => theme.colors.textMuted};
    cursor: grab;
    flex-shrink: 0;
  `,

  AddNodeBtn: styled.button`
    width: 40px;
    height: 40px;
    border-radius: 50%;
    border: 1px dashed ${({ theme }) => theme.colors.border};
    background: ${({ theme }) => theme.colors.surface};
    color: ${({ theme }) => theme.colors.textMuted};
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: ${({ theme }) => theme.transitions.fast};

    &:hover {
      border-style: solid;
      border-color: ${({ theme }) => theme.colors.primary};
      background: ${({ theme }) => theme.colors.primaryLight};
      color: ${({ theme }) => theme.colors.primary};
    }
  `,

  AddRow: styled.div`
    display: flex;
    align-items: center;
    justify-content: center;
    gap: ${({ theme }) => theme.spacing.sm};
  `,

  BranchSplit: styled.div`
    display: flex;
    align-items: flex-start;
    justify-content: center;
    gap: ${({ theme }) => theme.spacing.lg};
    width: 100%;
    margin-top: ${({ theme }) => theme.spacing.sm};
    overflow-x: auto;
  `,

  BranchLane: styled.div<{ $variant: 'true' | 'false' }>`
    flex: 1 1 0;
    min-width: 320px;
    max-width: 560px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.xs};
    padding: ${({ theme }) => theme.spacing.md};
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.borderRadius.lg};
    background: ${({ theme }) => theme.colors.surface};
  `,

  BranchLabel: styled.span<{ $variant: 'true' | 'false' }>`
    align-self: flex-start;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 3px 10px;
    border-radius: ${({ theme }) => theme.borderRadius.full};
    background: ${({ theme }) => theme.colors.surfaceHover};
    border: 1px solid ${({ theme }) => theme.colors.border};
    color: ${({ theme }) => theme.colors.textSecondary};
    font-size: ${({ theme }) => theme.fontSizes.xs};
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;

    &::before {
      content: '';
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: ${({ $variant, theme }) => ($variant === 'true' ? theme.colors.revenue : theme.colors.danger)};
    }
  `,

  BranchEmpty: styled.div`
    font-size: ${({ theme }) => theme.fontSizes.xs};
    color: ${({ theme }) => theme.colors.textMuted};
    padding: ${({ theme }) => theme.spacing.xs} 0;
  `,

  BranchListGroup: styled.div<{ $variant: 'true' | 'false' }>`
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.sm};
    margin: ${({ theme }) => theme.spacing.xs} 0 ${({ theme }) => theme.spacing.xs} ${({ theme }) => theme.spacing.lg};
    padding-left: ${({ theme }) => theme.spacing.md};
    border-left: 2px solid ${({ theme }) => theme.colors.border};
  `,

  StepRow: styled.div<{ $disabled?: boolean }>`
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.md};
    background: ${({ theme }) => theme.colors.surface};
    border: 1px ${({ $disabled }) => ($disabled ? 'dashed' : 'solid')} ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.borderRadius.lg};
    padding: ${({ theme }) => theme.spacing.md};
    opacity: ${({ $disabled }) => ($disabled ? 0.65 : 1)};
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

  StepResultCard: styled.div<{ $status?: 'SUCCESS' | 'ERROR' | 'WARN' | 'INFO' }>`
    margin-top: ${({ theme }) => theme.spacing.md};
    padding: ${({ theme }) => theme.spacing.md};
    background: ${({ theme }) => theme.colors.surfaceHover};
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-left: 3px solid ${({ $status, theme }) => (
      $status === 'SUCCESS' ? theme.colors.success :
        $status === 'ERROR' ? theme.colors.danger :
          $status === 'WARN' ? theme.colors.warning :
            theme.colors.border
    )};
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

  StepResultIcon: styled.div`
    display: flex;
    align-items: center;
    justify-content: center;
    color: ${({ theme }) => theme.colors.textMuted};
    flex-shrink: 0;
  `,

  StepStatusBadge: styled.span<{ $status: 'SUCCESS' | 'ERROR' | 'WARN' | 'INFO' }>`
    display: inline-flex;
    padding: 2px 6px;
    border-radius: ${({ theme }) => theme.borderRadius.full};
    font-size: ${({ theme }) => theme.fontSizes.xs};
    font-weight: 600;
    background: ${({ $status, theme }) => (
      $status === 'SUCCESS' ? `${theme.colors.success}20` :
        $status === 'ERROR' ? `${theme.colors.danger}20` :
          $status === 'WARN' ? `${theme.colors.warning}20` :
            `${theme.colors.textMuted}20`
    )};
    color: ${({ $status, theme }) => (
      $status === 'SUCCESS' ? theme.colors.success :
        $status === 'ERROR' ? theme.colors.danger :
          $status === 'WARN' ? theme.colors.warning :
            theme.colors.textMuted
    )};
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

  StepProgressBar: styled.div`
    display: flex;
    align-items: center;
    gap: 4px;
    margin-top: ${({ theme }) => theme.spacing.sm};
    padding: ${({ theme }) => theme.spacing.sm};
    background: ${({ theme }) => theme.colors.background};
    border-radius: ${({ theme }) => theme.borderRadius.md};
  `,

  StepProgressDot: styled.div<{ $status: 'SUCCESS' | 'ERROR' | 'WARN' | 'INFO' | 'PENDING' }>`
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: ${({ $status, theme }) => (
      $status === 'SUCCESS' ? theme.colors.success :
        $status === 'ERROR' ? theme.colors.danger :
          $status === 'WARN' ? theme.colors.warning :
            $status === 'INFO' ? theme.colors.textMuted :
              theme.colors.border
    )};
    flex-shrink: 0;
  `,

  StepProgressLabel: styled.div`
    font-size: ${({ theme }) => theme.fontSizes.xs};
    color: ${({ theme }) => theme.colors.textMuted};
    margin-left: ${({ theme }) => theme.spacing.xs};
  `,
};
