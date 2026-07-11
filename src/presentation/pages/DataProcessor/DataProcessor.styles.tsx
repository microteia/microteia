import styled from 'styled-components';
import type { StageStatus, ProcessorLogLevel } from './DataProcessor.viewmodel';

export const S = {
  Page: styled.div`
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.lg};
    padding: ${({ theme }) => theme.spacing.xl};
    max-width: 1080px;
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

  Grid: styled.div`
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: ${({ theme }) => theme.spacing.lg};

    @media (max-width: 900px) {
      grid-template-columns: 1fr;
    }
  `,

  Card: styled.section`
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.md};
    background: ${({ theme }) => theme.colors.surface};
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.borderRadius.lg};
    padding: ${({ theme }) => theme.spacing.lg};
  `,

  CardTitle: styled.h2`
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.sm};
    font-size: ${({ theme }) => theme.fontSizes.md};
    color: ${({ theme }) => theme.colors.text};
    margin: 0;
  `,

  StepBadge: styled.span`
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    border-radius: ${({ theme }) => theme.borderRadius.full};
    background: ${({ theme }) => theme.colors.primaryLight};
    color: ${({ theme }) => theme.colors.primary};
    font-size: ${({ theme }) => theme.fontSizes.xs};
    font-weight: 600;
  `,

  TextArea: styled.textarea`
    width: 100%;
    min-height: 220px;
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
    color: ${({ theme }) => theme.colors.textSecondary};
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  `,

  CanvasWrapper: styled.div`
    max-height: 320px;
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
  `,

  WorkflowList: styled.div`
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.sm};
    max-height: 340px;
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

  LogBox: styled.div`
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.xs};
  `,

  LogLine: styled.div<{ $level: ProcessorLogLevel }>`
    display: flex;
    align-items: flex-start;
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
    padding-top: ${({ theme }) => theme.spacing.sm};
  `,
};
