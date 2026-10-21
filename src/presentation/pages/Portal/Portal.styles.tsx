import styled from 'styled-components';

/** Os estados do portal antes do conteúdo: carregando, falha e a escolha de escritório. */
export const S = {
  Centered: styled.div`
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: ${({ theme }) => theme.spacing.md};
    padding: ${({ theme }) => theme.spacing.xl} ${({ theme }) => theme.spacing.md};
    text-align: center;
    color: ${({ theme }) => theme.colors.textSecondary};
  `,

  Title: styled.h1`
    font-size: ${({ theme }) => theme.fontSizes['2xl']};
    font-weight: 700;
    color: ${({ theme }) => theme.colors.text};
  `,

  Muted: styled.p`
    font-size: ${({ theme }) => theme.fontSizes.sm};
    color: ${({ theme }) => theme.colors.textMuted};
  `,

  List: styled.div`
    display: grid;
    gap: ${({ theme }) => theme.spacing.sm};
  `,

  Card: styled.button`
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.xs};
    width: 100%;
    padding: ${({ theme }) => theme.spacing.md};
    text-align: left;
    background: ${({ theme }) => theme.colors.surface};
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.borderRadius.lg};
    color: ${({ theme }) => theme.colors.text};
    cursor: pointer;
    transition: background ${({ theme }) => theme.transitions.fast};

    &:hover {
      background: ${({ theme }) => theme.colors.cardHover};
    }
  `,

  CardTitle: styled.span`
    font-size: ${({ theme }) => theme.fontSizes.md};
    font-weight: 600;
  `,
};
