import styled from 'styled-components';

export const S = {
  Footer: styled.footer`
    background: ${({ theme }) => theme.colors.surface};
    border-top: 1px solid ${({ theme }) => theme.colors.border};
  `,

  Content: styled.div`
    max-width: 1200px;
    margin: 0 auto;
    padding: ${({ theme }) => theme.spacing.xl} ${({ theme }) => theme.spacing.lg};
    display: grid;
    grid-template-columns: 2fr 1fr 1fr 1fr;
    gap: ${({ theme }) => theme.spacing.lg};

    @media (max-width: 768px) {
      grid-template-columns: 1fr;
    }
  `,

  Brand: styled.div`
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.sm};

    img {
      width: 32px;
      height: 32px;
      object-fit: contain;
    }

    span {
      font-size: ${({ theme }) => theme.fontSizes.md};
      font-weight: 700;
      color: ${({ theme }) => theme.colors.text};
    }
  `,

  LinkGroup: styled.div`
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.sm};
  `,

  GroupTitle: styled.span`
    font-size: ${({ theme }) => theme.fontSizes.xs};
    font-weight: 700;
    color: ${({ theme }) => theme.colors.textMuted};
    text-transform: uppercase;
    letter-spacing: 0.06em;
  `,

  Link: styled.button`
    background: none;
    border: none;
    padding: 0;
    text-align: left;
    cursor: pointer;
    font-size: ${({ theme }) => theme.fontSizes.sm};
    color: ${({ theme }) => theme.colors.textSecondary};
    transition: color ${({ theme }) => theme.transitions.fast};

    &:hover {
      color: ${({ theme }) => theme.colors.text};
    }
  `,

  EmailLink: styled.a`
    font-size: ${({ theme }) => theme.fontSizes.sm};
    color: ${({ theme }) => theme.colors.textSecondary};
    transition: color ${({ theme }) => theme.transitions.fast};

    &:hover {
      color: ${({ theme }) => theme.colors.text};
    }
  `,

  Bottom: styled.p`
    border-top: 1px solid ${({ theme }) => theme.colors.border};
    padding: ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.spacing.lg};
    text-align: center;
    font-size: ${({ theme }) => theme.fontSizes.xs};
    color: ${({ theme }) => theme.colors.textMuted};
  `,
};
