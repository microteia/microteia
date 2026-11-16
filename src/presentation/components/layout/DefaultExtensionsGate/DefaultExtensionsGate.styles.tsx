import styled from 'styled-components';

export const S = {
  Page: styled.div`
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: ${({ theme }) => theme.spacing.lg};
    background: ${({ theme }) => theme.colors.background};
  `,

  Card: styled.div`
    width: 100%;
    max-width: 460px;
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.md};
    padding: ${({ theme }) => theme.spacing.xl};
    background: ${({ theme }) => theme.colors.surface};
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.borderRadius.lg};
    box-shadow: 0 24px 64px ${({ theme }) => theme.colors.shadow};
  `,

  Header: styled.div`
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.sm};
    color: ${({ theme }) => theme.colors.primary};
  `,

  Title: styled.h1`
    margin: 0;
    font-size: ${({ theme }) => theme.fontSizes.xl};
    font-weight: 600;
    color: ${({ theme }) => theme.colors.text};
  `,

  Lead: styled.p`
    margin: 0;
    font-size: ${({ theme }) => theme.fontSizes.sm};
    line-height: 1.5;
    color: ${({ theme }) => theme.colors.textSecondary};
  `,

  Progress: styled.div`
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.sm};
    font-size: ${({ theme }) => theme.fontSizes.sm};
    color: ${({ theme }) => theme.colors.text};
  `,

  Error: styled.div`
    font-size: ${({ theme }) => theme.fontSizes.sm};
    color: ${({ theme }) => theme.colors.danger};
  `,

  Actions: styled.div`
    display: flex;
    justify-content: flex-end;
    gap: ${({ theme }) => theme.spacing.sm};
  `,
};
