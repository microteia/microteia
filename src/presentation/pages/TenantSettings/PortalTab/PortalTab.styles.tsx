import styled from 'styled-components';

export const S = {
  Container: styled.div`
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.lg};
  `,

  InviteRow: styled.div`
    display: grid;
    grid-template-columns: 1fr 1fr 1fr auto;
    gap: ${({ theme }) => theme.spacing.md};
    align-items: end;

    @media (max-width: 900px) {
      grid-template-columns: 1fr;
    }
  `,

  ClaimRow: styled.div`
    grid-column: 1 / -1;
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: ${({ theme }) => theme.spacing.md};

    @media (max-width: 900px) {
      grid-template-columns: 1fr;
    }
  `,

  ListTitle: styled.h3`
    font-size: ${({ theme }) => theme.fontSizes.md};
    font-weight: 600;
    color: ${({ theme }) => theme.colors.text};
  `,

  Verified: styled.span`
    display: inline-flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.xs};
    margin-left: ${({ theme }) => theme.spacing.sm};
    padding: 1px ${({ theme }) => theme.spacing.sm};
    border-radius: ${({ theme }) => theme.borderRadius.full};
    border: 1px solid ${({ theme }) => theme.colors.success};
    color: ${({ theme }) => theme.colors.success};
    font-size: ${({ theme }) => theme.fontSizes.xs};
    font-weight: 500;
  `,

  Suspended: styled.span`
    display: inline-flex;
    margin-left: ${({ theme }) => theme.spacing.sm};
    padding: 1px ${({ theme }) => theme.spacing.sm};
    border-radius: ${({ theme }) => theme.borderRadius.full};
    background: ${({ theme }) => theme.colors.warningLight};
    color: ${({ theme }) => theme.colors.warning};
    font-size: ${({ theme }) => theme.fontSizes.xs};
    font-weight: 500;
  `,

  Column: styled.div`
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.xs};
  `,

  GuestList: styled.div`
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.sm};
  `,

  GuestRow: styled.div`
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.md};
    padding: ${({ theme }) => theme.spacing.md};
    background: ${({ theme }) => theme.colors.surface};
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.borderRadius.md};
  `,

  GuestInfo: styled.div`
    flex: 1;
    min-width: 200px;
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.xs};
  `,

  GuestName: styled.span`
    font-size: ${({ theme }) => theme.fontSizes.sm};
    font-weight: 600;
    color: ${({ theme }) => theme.colors.text};
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

  Empty: styled.p`
    font-size: ${({ theme }) => theme.fontSizes.sm};
    color: ${({ theme }) => theme.colors.textMuted};
  `,

  SpinnerWrap: styled.div`
    display: flex;
    justify-content: center;
    padding: ${({ theme }) => theme.spacing.xl};
  `,
};
