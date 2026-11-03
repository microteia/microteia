import styled from 'styled-components';

export const S = {
  Frame: styled.section`
    display: flex;
    flex-direction: column;
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.borderRadius.md};
    background: ${({ theme }) => theme.colors.surface};
    min-width: 0;
  `,

  Header: styled.div`
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: ${({ theme }) => theme.spacing.sm};
    padding: ${({ theme }) => theme.spacing.md};
    border-bottom: 1px solid ${({ theme }) => theme.colors.borderSubtle};
  `,

  Title: styled.h3`
    font-size: ${({ theme }) => theme.fontSizes.md};
    font-weight: 600;
    color: ${({ theme }) => theme.colors.text};
  `,

  Search: styled.div`
    position: relative;
    flex: 0 1 320px;
    min-width: 200px;
    display: flex;
    align-items: center;
    color: ${({ theme }) => theme.colors.textMuted};

    & > svg {
      position: absolute;
      left: ${({ theme }) => theme.spacing.sm};
      pointer-events: none;
    }

    & > input {
      padding-left: ${({ theme }) => theme.spacing.xl};
    }
  `,

  /** A lista rola DENTRO da moldura: milhares de convidados não esticam a aba. */
  Body: styled.div`
    display: flex;
    flex-direction: column;
    max-height: 60vh;
    overflow-y: auto;
  `,

  Message: styled.p`
    padding: ${({ theme }) => theme.spacing.lg} ${({ theme }) => theme.spacing.md};
    font-size: ${({ theme }) => theme.fontSizes.sm};
    color: ${({ theme }) => theme.colors.textMuted};
    text-align: center;
  `,

  SpinnerWrap: styled.div`
    display: flex;
    justify-content: center;
    padding: ${({ theme }) => theme.spacing.lg};
  `,

  Footer: styled.div`
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: ${({ theme }) => theme.spacing.sm};
    padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md};
    border-top: 1px solid ${({ theme }) => theme.colors.borderSubtle};
    font-size: ${({ theme }) => theme.fontSizes.xs};
    color: ${({ theme }) => theme.colors.textMuted};
  `,
};
