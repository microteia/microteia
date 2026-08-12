import styled, { keyframes } from 'styled-components';

const fadeIn = keyframes`
  from { opacity: 0; }
  to { opacity: 1; }
`;

const slideUp = keyframes`
  from { transform: translateY(12px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
`;

export const S = {
  Overlay: styled.div`
    position: fixed;
    inset: 0;
    background: ${({ theme }) => theme.colors.overlay};
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2000;
    padding: ${({ theme }) => theme.spacing.md};
    backdrop-filter: blur(4px);
    animation: ${fadeIn} 150ms ease;
  `,

  Box: styled.div`
    background: ${({ theme }) => theme.colors.surface};
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.borderRadius.lg};
    width: 100%;
    max-width: 640px;
    max-height: 88vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 24px 64px ${({ theme }) => theme.colors.shadow};
    animation: ${slideUp} 200ms ease;
  `,

  Header: styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: ${({ theme }) => theme.spacing.md};
    padding: ${({ theme }) => theme.spacing.lg} ${({ theme }) => theme.spacing.xl};
    border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  `,

  Title: styled.h3`
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.sm};
    font-size: ${({ theme }) => theme.fontSizes.lg};
    font-weight: 600;
    color: ${({ theme }) => theme.colors.text};
  `,

  CloseBtn: styled.button`
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border: none;
    border-radius: ${({ theme }) => theme.borderRadius.md};
    background: transparent;
    color: ${({ theme }) => theme.colors.textMuted};
    cursor: pointer;
    &:hover {
      background: ${({ theme }) => theme.colors.surfaceHover};
      color: ${({ theme }) => theme.colors.text};
    }
  `,

  Body: styled.div`
    padding: ${({ theme }) => theme.spacing.xl};
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.lg};
  `,

  Footer: styled.div`
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: ${({ theme }) => theme.spacing.sm};
    padding: ${({ theme }) => theme.spacing.lg} ${({ theme }) => theme.spacing.xl};
    border-top: 1px solid ${({ theme }) => theme.colors.border};
  `,

  ModeTabs: styled.div`
    display: inline-flex;
    gap: ${({ theme }) => theme.spacing.xs};
    padding: ${({ theme }) => theme.spacing.xs};
    background: ${({ theme }) => theme.colors.inputBackground};
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.borderRadius.md};
    align-self: flex-start;
  `,

  ModeTab: styled.button<{ $active?: boolean }>`
    padding: 6px 14px;
    border: none;
    border-radius: ${({ theme }) => theme.borderRadius.md};
    background: ${({ theme, $active }) => ($active ? theme.colors.primary : 'transparent')};
    color: ${({ theme, $active }) => ($active ? theme.colors.background : theme.colors.textSecondary)};
    font-size: ${({ theme }) => theme.fontSizes.xs};
    font-weight: 600;
    cursor: pointer;
    &:hover {
      color: ${({ theme, $active }) => ($active ? theme.colors.background : theme.colors.text)};
    }
  `,

  Field: styled.div`
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.xs};
  `,

  FieldLabel: styled.label`
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.xs};
    font-size: ${({ theme }) => theme.fontSizes.sm};
    font-weight: 500;
    color: ${({ theme }) => theme.colors.text};
  `,

  FieldKey: styled.span`
    font-family: ${({ theme }) => theme.fonts.mono};
    font-size: ${({ theme }) => theme.fontSizes.xs};
    color: ${({ theme }) => theme.colors.textMuted};
  `,

  Required: styled.span`
    color: ${({ theme }) => theme.colors.danger};
  `,

  JsonArea: styled.textarea`
    width: 100%;
    min-height: 220px;
    padding: ${({ theme }) => theme.spacing.md};
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.borderRadius.md};
    background: ${({ theme }) => theme.colors.inputBackground};
    color: ${({ theme }) => theme.colors.text};
    font-family: ${({ theme }) => theme.fonts.mono};
    font-size: ${({ theme }) => theme.fontSizes.xs};
    line-height: 1.6;
    resize: vertical;
    outline: none;
    &:focus {
      border-color: ${({ theme }) => theme.colors.primary};
    }
  `,

  EmptyHint: styled.p`
    font-size: ${({ theme }) => theme.fontSizes.sm};
    color: ${({ theme }) => theme.colors.textSecondary};
    line-height: 1.6;
  `,

  JsonError: styled.p`
    font-size: ${({ theme }) => theme.fontSizes.xs};
    color: ${({ theme }) => theme.colors.danger};
    font-family: ${({ theme }) => theme.fonts.mono};
  `,

  ResultHeader: styled.div`
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.sm};
  `,

  StatusBadge: styled.span<{ $tone: 'success' | 'danger' | 'warning' }>`
    display: inline-flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.xs};
    padding: 3px 10px;
    border-radius: ${({ theme }) => theme.borderRadius.md};
    font-size: ${({ theme }) => theme.fontSizes.xs};
    font-weight: 600;
    color: ${({ theme, $tone }) => theme.colors[$tone]};
    background: ${({ theme }) => theme.colors.surfaceHover};
    border: 1px solid ${({ theme, $tone }) => theme.colors[$tone]};
  `,

  SectionLabel: styled.h4`
    font-size: ${({ theme }) => theme.fontSizes.sm};
    font-weight: 600;
    color: ${({ theme }) => theme.colors.text};
    margin-bottom: ${({ theme }) => theme.spacing.xs};
  `,

  Pre: styled.pre`
    margin: 0;
    padding: ${({ theme }) => theme.spacing.md};
    background: ${({ theme }) => theme.colors.inputBackground};
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.borderRadius.md};
    font-family: ${({ theme }) => theme.fonts.mono};
    font-size: ${({ theme }) => theme.fontSizes.xs};
    color: ${({ theme }) => theme.colors.text};
    line-height: 1.6;
    overflow-x: auto;
    white-space: pre-wrap;
    word-break: break-word;
  `,

  LogList: styled.div`
    display: flex;
    flex-direction: column;
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.borderRadius.md};
    background: ${({ theme }) => theme.colors.inputBackground};
    overflow: hidden;
  `,

  LogLine: styled.div<{ $tone: 'success' | 'danger' | 'warning' | 'muted' }>`
    display: flex;
    gap: ${({ theme }) => theme.spacing.sm};
    padding: 6px ${({ theme }) => theme.spacing.md};
    font-family: ${({ theme }) => theme.fonts.mono};
    font-size: ${({ theme }) => theme.fontSizes.xs};
    line-height: 1.6;
    color: ${({ theme }) => theme.colors.text};
    & + & {
      border-top: 1px solid ${({ theme }) => theme.colors.border};
    }
  `,

  LogLevel: styled.span<{ $tone: 'success' | 'danger' | 'warning' | 'muted' }>`
    flex-shrink: 0;
    font-weight: 700;
    color: ${({ theme, $tone }) =>
      $tone === 'muted' ? theme.colors.textMuted : theme.colors[$tone]};
  `,

  LogMessage: styled.span`
    white-space: pre-wrap;
    word-break: break-word;
  `,

  EmptyLogs: styled.p`
    font-size: ${({ theme }) => theme.fontSizes.xs};
    color: ${({ theme }) => theme.colors.textMuted};
    font-style: italic;
  `,

  ErrorBox: styled.div`
    padding: ${({ theme }) => theme.spacing.md};
    border: 1px solid ${({ theme }) => theme.colors.danger};
    border-radius: ${({ theme }) => theme.borderRadius.md};
    background: ${({ theme }) => theme.colors.surfaceHover};
    color: ${({ theme }) => theme.colors.danger};
    font-size: ${({ theme }) => theme.fontSizes.sm};
    line-height: 1.6;
  `,
};
