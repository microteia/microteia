import styled from 'styled-components';

export const S = {
  Panel: styled.div`
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.lg};
    padding: ${({ theme }) => theme.spacing.lg};
    overflow-y: auto;
    flex: 1;
  `,

  Section: styled.section`
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.md};
    padding: ${({ theme }) => theme.spacing.lg};
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.borderRadius.md};
    background: ${({ theme }) => theme.colors.surface};
    max-width: 880px;
  `,

  SectionTitle: styled.h3`
    margin: 0;
    font-size: ${({ theme }) => theme.fontSizes.md};
    font-weight: 600;
    color: ${({ theme }) => theme.colors.text};
  `,

  Description: styled.p`
    margin: 0;
    font-size: ${({ theme }) => theme.fontSizes.sm};
    color: ${({ theme }) => theme.colors.textSecondary};
    line-height: 1.5;
  `,

  Fields: styled.div`
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: ${({ theme }) => theme.spacing.md};
  `,

  Field: styled.label`
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.xs};
    font-size: ${({ theme }) => theme.fontSizes.sm};
    color: ${({ theme }) => theme.colors.textSecondary};
  `,

  Hint: styled.span<{ $error?: boolean }>`
    font-size: ${({ theme }) => theme.fontSizes.xs};
    color: ${({ theme, $error }) => ($error ? theme.colors.danger : theme.colors.textMuted)};
  `,

  Actions: styled.div`
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.sm};
    flex-wrap: wrap;
  `,

  Facts: styled.dl`
    display: grid;
    grid-template-columns: max-content 1fr;
    gap: ${({ theme }) => theme.spacing.xs} ${({ theme }) => theme.spacing.md};
    margin: 0;
    font-size: ${({ theme }) => theme.fontSizes.sm};
  `,

  FactLabel: styled.dt`
    color: ${({ theme }) => theme.colors.textMuted};
  `,

  FactValue: styled.dd`
    margin: 0;
    color: ${({ theme }) => theme.colors.text};
    min-width: 0;
  `,

  HashRow: styled.div`
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.xs};
    min-width: 0;
  `,

  Hash: styled.code`
    font-family: ${({ theme }) => theme.fonts.mono};
    font-size: ${({ theme }) => theme.fontSizes.xs};
    color: ${({ theme }) => theme.colors.text};
    word-break: break-all;
  `,

  Detail: styled.p`
    margin: 0;
    font-size: ${({ theme }) => theme.fontSizes.sm};
    color: ${({ theme }) => theme.colors.textSecondary};
    word-break: break-word;
  `,

  DayPicker: styled.div`
    display: flex;
    align-items: flex-end;
    gap: ${({ theme }) => theme.spacing.sm};
    max-width: 360px;
  `,

  Lines: styled.div`
    display: flex;
    flex-direction: column;
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.borderRadius.sm};
    overflow: hidden;
  `,
};
