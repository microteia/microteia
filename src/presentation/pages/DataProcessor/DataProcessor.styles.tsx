import styled, { css, keyframes } from 'styled-components';
import type { StageStatus, ProcessorLogLevel, StepStatus } from './DataProcessor.viewmodel';

const fadeIn = keyframes`
  from {
    opacity: 0;
    transform: translateY(6px);
  }
  to {
    opacity: 1;
    transform: none;
  }
`;

const pulse = keyframes`
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.45;
  }
`;

export const S = {
  Page: styled.div`
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.lg};
    padding: ${({ theme }) => theme.spacing.xl};
    max-width: 900px;
    margin: 0 auto;
    width: 100%;
  `,

  Header: styled.div`
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.xs};
  `,

  Title: styled.h1`
    font-size: ${({ theme }) => theme.fontSizes['2xl']};
    color: ${({ theme }) => theme.colors.text};
    margin: 0;
  `,

  Subtitle: styled.p`
    font-size: ${({ theme }) => theme.fontSizes.sm};
    color: ${({ theme }) => theme.colors.textSecondary};
    margin: 0;
  `,

  Stepper: styled.nav`
    display: flex;
    align-items: flex-start;
    gap: ${({ theme }) => theme.spacing.xs};
  `,

  StepperItem: styled.div`
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.xs};
    flex: 1;

    &:last-child {
      flex: 0 0 auto;
    }
  `,

  StepButton: styled.button<{ $status: StepStatus }>`
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.sm};
    padding: ${({ theme }) => `${theme.spacing.xs} ${theme.spacing.sm}`};
    border: none;
    background: none;
    border-radius: ${({ theme }) => theme.borderRadius.full};
    cursor: ${({ $status }) => ($status === 'locked' ? 'not-allowed' : 'pointer')};
    transition: ${({ theme }) => theme.transitions.fast};

    &:hover:not(:disabled) {
      background: ${({ theme }) => theme.colors.surfaceHover};
    }
  `,

  StepMarker: styled.span<{ $status: StepStatus }>`
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    width: 30px;
    height: 30px;
    border-radius: ${({ theme }) => theme.borderRadius.full};
    font-size: ${({ theme }) => theme.fontSizes.xs};
    font-weight: 700;
    transition: ${({ theme }) => theme.transitions.fast};

    ${({ theme, $status }) => {
      if ($status === 'done') {
        return css`
          background: ${theme.colors.success};
          color: ${theme.colors.white};
          border: 1px solid ${theme.colors.success};
        `;
      }
      if ($status === 'current') {
        return css`
          background: ${theme.colors.primary};
          color: ${theme.colors.white};
          border: 1px solid ${theme.colors.primary};
          box-shadow: 0 0 0 4px ${theme.colors.primaryLight};
        `;
      }
      return css`
        background: ${theme.colors.inputBackground};
        color: ${theme.colors.textMuted};
        border: 1px solid ${theme.colors.border};
      `;
    }}
  `,

  StepLabel: styled.span<{ $status: StepStatus }>`
    font-size: ${({ theme }) => theme.fontSizes.sm};
    font-weight: 600;
    white-space: nowrap;
    color: ${({ theme, $status }) =>
      $status === 'current'
        ? theme.colors.text
        : $status === 'locked'
          ? theme.colors.textMuted
          : theme.colors.textSecondary};

    @media (max-width: 760px) {
      display: none;
    }
  `,

  StepConnector: styled.span<{ $filled: boolean }>`
    flex: 1;
    height: 2px;
    min-width: ${({ theme }) => theme.spacing.sm};
    border-radius: ${({ theme }) => theme.borderRadius.full};
    background: ${({ theme, $filled }) => ($filled ? theme.colors.success : theme.colors.border)};
    transition: ${({ theme }) => theme.transitions.normal};
  `,

  Card: styled.section`
    display: flex;
    flex-direction: column;
    background: ${({ theme }) => theme.colors.surface};
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.borderRadius.lg};
    overflow: hidden;
  `,

  CardHeader: styled.header`
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.md};
    padding: ${({ theme }) => `${theme.spacing.lg} ${theme.spacing.lg}`};
    border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  `,

  CardIcon: styled.span`
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    width: 42px;
    height: 42px;
    border-radius: ${({ theme }) => theme.borderRadius.md};
    background: ${({ theme }) => theme.colors.primaryLight};
    color: ${({ theme }) => theme.colors.primary};
    font-size: ${({ theme }) => theme.fontSizes.lg};
  `,

  CardHeading: styled.div`
    display: flex;
    flex-direction: column;
    gap: 2px;
  `,

  CardTitle: styled.h2`
    font-size: ${({ theme }) => theme.fontSizes.lg};
    color: ${({ theme }) => theme.colors.text};
    margin: 0;
  `,

  CardHint: styled.p`
    font-size: ${({ theme }) => theme.fontSizes.sm};
    color: ${({ theme }) => theme.colors.textSecondary};
    margin: 0;
  `,

  Panel: styled.div`
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.md};
    padding: ${({ theme }) => theme.spacing.lg};
    animation: ${fadeIn} ${({ theme }) => theme.transitions.normal};
  `,

  Footer: styled.footer`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: ${({ theme }) => theme.spacing.md};
    padding: ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.spacing.lg};
    border-top: 1px solid ${({ theme }) => theme.colors.border};
    background: ${({ theme }) => theme.colors.inputBackground};
  `,

  FooterHint: styled.span`
    font-size: ${({ theme }) => theme.fontSizes.xs};
    color: ${({ theme }) => theme.colors.textSecondary};
  `,

  TextArea: styled.textarea`
    width: 100%;
    min-height: 200px;
    resize: vertical;
    padding: ${({ theme }) => theme.spacing.md};
    border-radius: ${({ theme }) => theme.borderRadius.md};
    border: 1px solid ${({ theme }) => theme.colors.border};
    background: ${({ theme }) => theme.colors.inputBackground};
    color: ${({ theme }) => theme.colors.text};
    font-family: ${({ theme }) => theme.fonts.body};
    font-size: ${({ theme }) => theme.fontSizes.sm};
    line-height: 1.5;

    &:focus {
      outline: none;
      border-color: ${({ theme }) => theme.colors.primary};
    }
  `,

  Row: styled.div`
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.sm};
    flex-wrap: wrap;
  `,

  SpaceBetween: styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: ${({ theme }) => theme.spacing.sm};
    flex-wrap: wrap;
  `,

  Dropzone: styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: ${({ theme }) => theme.spacing.md};
    padding: ${({ theme }) => theme.spacing.md};
    border: 1px dashed ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.borderRadius.md};
    background: ${({ theme }) => theme.colors.inputBackground};
    flex-wrap: wrap;
  `,

  DropzoneInfo: styled.div`
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.sm};
    color: ${({ theme }) => theme.colors.textSecondary};
    font-size: ${({ theme }) => theme.fontSizes.sm};
    min-width: 0;
  `,

  HiddenFileInput: styled.input`
    display: none;
  `,

  Button: styled.button<{ $variant?: 'primary' | 'ghost' }>`
    display: inline-flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.xs};
    padding: ${({ theme }) => `${theme.spacing.sm} ${theme.spacing.md}`};
    border-radius: ${({ theme }) => theme.borderRadius.md};
    font-size: ${({ theme }) => theme.fontSizes.sm};
    font-weight: 600;
    cursor: pointer;
    white-space: nowrap;
    transition: ${({ theme }) => theme.transitions.fast};
    border: 1px solid
      ${({ theme, $variant }) => ($variant === 'ghost' ? theme.colors.border : 'transparent')};
    background: ${({ theme, $variant }) =>
      $variant === 'ghost' ? 'transparent' : theme.colors.primary};
    color: ${({ theme, $variant }) => ($variant === 'ghost' ? theme.colors.text : theme.colors.white)};

    &:hover:not(:disabled) {
      background: ${({ theme, $variant }) =>
        $variant === 'ghost' ? theme.colors.surfaceHover : theme.colors.primaryHover};
    }

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  `,

  LinkButton: styled.button`
    display: inline-flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.xs};
    background: none;
    border: none;
    padding: 0;
    color: ${({ theme }) => theme.colors.primary};
    font-size: ${({ theme }) => theme.fontSizes.sm};
    font-weight: 600;
    cursor: pointer;
    text-align: left;

    &:hover {
      text-decoration: underline;
    }
  `,

  FileName: styled.span`
    font-size: ${({ theme }) => theme.fontSizes.sm};
    color: ${({ theme }) => theme.colors.text};
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  `,

  PageSelector: styled.div`
    display: flex;
    align-items: flex-end;
    gap: ${({ theme }) => theme.spacing.sm};
  `,

  PageSelectorField: styled.div`
    flex: 1;
    min-width: 0;
  `,

  CanvasWrapper: styled.div`
    max-height: 360px;
    overflow: auto;
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.borderRadius.md};
    background: ${({ theme }) => theme.colors.background};
    display: flex;
    justify-content: center;
    padding: ${({ theme }) => theme.spacing.sm};
  `,

  PreviewImg: styled.img`
    max-width: 100%;
    height: auto;
    border-radius: ${({ theme }) => theme.borderRadius.sm};
  `,

  WorkflowList: styled.div`
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.sm};
    max-height: 380px;
    overflow-y: auto;
  `,

  WorkflowItem: styled.button<{ $selected?: boolean; $eligible?: boolean }>`
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.xs};
    text-align: left;
    padding: ${({ theme }) => theme.spacing.md};
    border-radius: ${({ theme }) => theme.borderRadius.md};
    border: 1px solid
      ${({ theme, $selected }) => ($selected ? theme.colors.primary : theme.colors.border)};
    background: ${({ theme, $selected }) =>
      $selected ? theme.colors.primaryLight : theme.colors.inputBackground};
    cursor: ${({ $eligible }) => ($eligible ? 'pointer' : 'not-allowed')};
    opacity: ${({ $eligible }) => ($eligible ? 1 : 0.55)};
    transition: ${({ theme }) => theme.transitions.fast};

    &:hover:not(:disabled) {
      border-color: ${({ theme, $eligible }) => ($eligible ? theme.colors.primary : theme.colors.border)};
    }
  `,

  WorkflowName: styled.span`
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.sm};
    font-size: ${({ theme }) => theme.fontSizes.sm};
    font-weight: 600;
    color: ${({ theme }) => theme.colors.text};
  `,

  WorkflowDesc: styled.span`
    font-size: ${({ theme }) => theme.fontSizes.xs};
    color: ${({ theme }) => theme.colors.textSecondary};
  `,

  Tag: styled.span<{ $tone?: 'primary' | 'warning' }>`
    font-size: ${({ theme }) => theme.fontSizes.xs};
    font-weight: 600;
    padding: 2px 8px;
    border-radius: ${({ theme }) => theme.borderRadius.full};
    background: ${({ theme, $tone }) =>
      $tone === 'warning' ? theme.colors.warningLight : theme.colors.primaryLight};
    color: ${({ theme, $tone }) => ($tone === 'warning' ? theme.colors.warning : theme.colors.primary)};
  `,

  Empty: styled.p`
    font-size: ${({ theme }) => theme.fontSizes.sm};
    color: ${({ theme }) => theme.colors.textSecondary};
    margin: 0;
  `,

  Loading: styled.p`
    font-size: ${({ theme }) => theme.fontSizes.sm};
    color: ${({ theme }) => theme.colors.textSecondary};
    margin: 0;
    animation: ${pulse} 1.2s ease-in-out infinite;
  `,

  Summary: styled.dl`
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.sm};
    margin: 0;
    padding: ${({ theme }) => theme.spacing.md};
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.borderRadius.md};
    background: ${({ theme }) => theme.colors.inputBackground};
  `,

  SummaryRow: styled.div`
    display: flex;
    align-items: baseline;
    gap: ${({ theme }) => theme.spacing.md};
  `,

  SummaryLabel: styled.dt`
    flex-shrink: 0;
    width: 140px;
    font-size: ${({ theme }) => theme.fontSizes.xs};
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: ${({ theme }) => theme.colors.textMuted};
  `,

  SummaryValue: styled.dd`
    margin: 0;
    min-width: 0;
    font-size: ${({ theme }) => theme.fontSizes.sm};
    color: ${({ theme }) => theme.colors.text};
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  `,

  LogBox: styled.div`
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.xs};
  `,

  LogLine: styled.div<{ $level: ProcessorLogLevel }>`
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: ${({ theme }) => theme.spacing.sm};
    font-size: ${({ theme }) => theme.fontSizes.xs};
    padding: ${({ theme }) => `${theme.spacing.xs} ${theme.spacing.sm}`};
    border-left: 3px solid
      ${({ theme, $level }) =>
        $level === 'error'
          ? theme.colors.danger
          : $level === 'warn'
            ? theme.colors.warning
            : $level === 'success'
              ? theme.colors.success
              : theme.colors.border};
    background: ${({ theme }) => theme.colors.inputBackground};
    border-radius: ${({ theme }) => theme.borderRadius.sm};
    color: ${({ theme }) => theme.colors.textSecondary};
  `,

  Timeline: styled.div`
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.md};
    padding: ${({ theme }) => theme.spacing.md};
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.borderRadius.md};
  `,

  Stage: styled.div`
    display: flex;
    align-items: flex-start;
    gap: ${({ theme }) => theme.spacing.md};
  `,

  StageDot: styled.span<{ $status: StageStatus }>`
    flex-shrink: 0;
    width: 14px;
    height: 14px;
    margin-top: 3px;
    border-radius: ${({ theme }) => theme.borderRadius.full};
    background: ${({ theme, $status }) =>
      $status === 'success'
        ? theme.colors.success
        : $status === 'error'
          ? theme.colors.danger
          : $status === 'running'
            ? theme.colors.primary
            : theme.colors.border};
    box-shadow: ${({ theme, $status }) =>
      $status === 'running' ? `0 0 0 4px ${theme.colors.primaryLight}` : 'none'};
    animation: ${({ $status }) =>
      $status === 'running'
        ? css`
            ${pulse} 1.2s ease-in-out infinite
          `
        : 'none'};
  `,

  StageBody: styled.div`
    display: flex;
    flex-direction: column;
    gap: 2px;
  `,

  StageLabel: styled.span`
    font-size: ${({ theme }) => theme.fontSizes.sm};
    font-weight: 600;
    color: ${({ theme }) => theme.colors.text};
  `,

  StageDetail: styled.span<{ $status: StageStatus }>`
    font-size: ${({ theme }) => theme.fontSizes.xs};
    color: ${({ theme, $status }) =>
      $status === 'error'
        ? theme.colors.danger
        : $status === 'success'
          ? theme.colors.success
          : theme.colors.textSecondary};
  `,

  ResultActions: styled.div`
    display: flex;
    gap: ${({ theme }) => theme.spacing.md};
    flex-wrap: wrap;
  `,
};
