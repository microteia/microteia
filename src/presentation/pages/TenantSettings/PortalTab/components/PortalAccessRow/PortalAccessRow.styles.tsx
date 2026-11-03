import styled from 'styled-components';

export const S = {
  Row: styled.div`
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.md};
    padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md};

    & + & {
      border-top: 1px solid ${({ theme }) => theme.colors.borderSubtle};
    }
  `,

  Info: styled.div`
    flex: 1;
    min-width: 200px;
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.xs};
  `,

  Name: styled.span`
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.sm};
    font-size: ${({ theme }) => theme.fontSizes.sm};
    font-weight: 600;
    color: ${({ theme }) => theme.colors.text};
  `,

  Verified: styled.span`
    display: inline-flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.xs};
    padding: 1px ${({ theme }) => theme.spacing.sm};
    border-radius: ${({ theme }) => theme.borderRadius.full};
    border: 1px solid ${({ theme }) => theme.colors.success};
    color: ${({ theme }) => theme.colors.success};
    font-size: ${({ theme }) => theme.fontSizes.xs};
    font-weight: 500;
  `,

  Suspended: styled.span`
    display: inline-flex;
    padding: 1px ${({ theme }) => theme.spacing.sm};
    border-radius: ${({ theme }) => theme.borderRadius.full};
    background: ${({ theme }) => theme.colors.warningLight};
    color: ${({ theme }) => theme.colors.warning};
    font-size: ${({ theme }) => theme.fontSizes.xs};
    font-weight: 500;
  `,

  Meta: styled.span`
    font-size: ${({ theme }) => theme.fontSizes.xs};
    color: ${({ theme }) => theme.colors.textMuted};
    overflow-wrap: anywhere;
  `,

  Subjects: styled.div`
    display: flex;
    flex-wrap: wrap;
    gap: ${({ theme }) => theme.spacing.xs};
  `,

  Subject: styled.span`
    display: inline-flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.xs};
    padding: 2px ${({ theme }) => theme.spacing.sm};
    border-radius: ${({ theme }) => theme.borderRadius.full};
    background: ${({ theme }) => theme.colors.primaryLight};
    color: ${({ theme }) => theme.colors.primary};
    font-size: ${({ theme }) => theme.fontSizes.xs};
  `,

  SubjectRemove: styled.button`
    display: inline-flex;
    border: none;
    background: none;
    padding: 0;
    color: inherit;
    cursor: pointer;
  `,

  Actions: styled.div`
    display: flex;
    gap: ${({ theme }) => theme.spacing.sm};
  `,
};
