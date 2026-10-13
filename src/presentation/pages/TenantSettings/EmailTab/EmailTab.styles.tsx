import styled from 'styled-components';

export const S = {
  Container: styled.div`
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.lg};
    max-width: 880px;
  `,

  Intro: styled.div`
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.xs};
    max-width: 60ch;
  `,

  Title: styled.h3`
    margin: 0;
    font-size: ${({ theme }) => theme.fontSizes.lg};
    font-weight: 600;
    color: ${({ theme }) => theme.colors.text};
  `,

  Description: styled.p`
    margin: 0;
    font-size: ${({ theme }) => theme.fontSizes.sm};
    color: ${({ theme }) => theme.colors.textSecondary};
    line-height: 1.5;
  `,

  Grid: styled.div`
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
    gap: ${({ theme }) => theme.spacing.md};
  `,

  Field: styled.div`
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.xs};
  `,

  FieldLabel: styled.label`
    font-size: ${({ theme }) => theme.fontSizes.sm};
    font-weight: 500;
    color: ${({ theme }) => theme.colors.text};
  `,

  FieldHint: styled.span`
    font-size: ${({ theme }) => theme.fontSizes.xs};
    color: ${({ theme }) => theme.colors.textMuted};
    line-height: 1.5;
  `,

  CheckboxSlot: styled.div`
    display: flex;
    align-items: center;
    min-height: 38px;
  `,

  Issue: styled.span`
    font-size: ${({ theme }) => theme.fontSizes.sm};
    color: ${({ theme }) => theme.colors.danger};
  `,

  Actions: styled.div`
    display: flex;
    justify-content: flex-end;
    flex-wrap: wrap;
    gap: ${({ theme }) => theme.spacing.sm};
  `,
};
