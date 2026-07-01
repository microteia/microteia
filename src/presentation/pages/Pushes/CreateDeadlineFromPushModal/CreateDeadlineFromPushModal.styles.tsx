import styled from 'styled-components';

export const S = {
  FormGrid: styled.div`
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.lg};
  `,

  FormGroup: styled.div`
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.sm};
  `,

  ProcessHeader: styled.div`
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.md};
    padding: ${({ theme }) => theme.spacing.lg};
    background: ${({ theme }) => theme.colors.surface};
    border-radius: ${({ theme }) => theme.borderRadius.md};
    border: 1px solid ${({ theme }) => theme.colors.border};
  `,

  ProcessLabel: styled.div`
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.xs};
    flex: 1;
  `,

  ProcessNumber: styled.div`
    font-size: ${({ theme }) => theme.fontSizes.lg};
    font-weight: 600;
    color: ${({ theme }) => theme.colors.text};
  `,

  ProcessStatus: styled.div.attrs<{ $exists: boolean }>({})<{ $exists: boolean }>`
    font-size: ${({ theme }) => theme.fontSizes.sm};
    font-weight: 500;
    color: ${({ theme, $exists }) => $exists ? theme.colors.success : theme.colors.textSecondary};
  `,

  WarningBanner: styled.div`
    display: flex;
    align-items: flex-start;
    gap: ${({ theme }) => theme.spacing.md};
    padding: ${({ theme }) => theme.spacing.md};
    background: ${({ theme }) => `${theme.colors.warning}15`};
    border: 1px solid ${({ theme }) => theme.colors.warning};
    border-radius: ${({ theme }) => theme.borderRadius.md};
    color: ${({ theme }) => theme.colors.text};
    font-size: ${({ theme }) => theme.fontSizes.sm};
    line-height: 1.5;

    svg {
      flex-shrink: 0;
      margin-top: 2px;
      color: ${({ theme }) => theme.colors.warning};
    }
  `,

  Actions: styled.div`
    display: flex;
    gap: ${({ theme }) => theme.spacing.md};
    justify-content: flex-end;
    margin-top: ${({ theme }) => theme.spacing.md};
  `,
};
