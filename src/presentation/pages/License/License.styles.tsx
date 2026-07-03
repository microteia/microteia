import styled from 'styled-components';

export const S = {
  Page: styled.div`
    min-height: 100vh;
    display: flex;
    justify-content: center;
    background: ${({ theme }) => theme.colors.background};
    padding: ${({ theme }) => theme.spacing.xl} ${({ theme }) => theme.spacing.md};
  `,

  Card: styled.div`
    background: ${({ theme }) => theme.colors.surface};
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.borderRadius.xl};
    padding: ${({ theme }) => theme.spacing['2xl']};
    width: 100%;
    max-width: 760px;
    box-shadow: 0 24px 64px ${({ theme }) => theme.colors.shadow};
  `,

  Logo: styled.div`
    width: 64px;
    height: 64px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto ${({ theme }) => theme.spacing.lg};

    img {
      width: 100%;
      height: 100%;
      object-fit: contain;
    }
  `,

  Title: styled.h1`
    font-size: ${({ theme }) => theme.fontSizes['2xl']};
    font-weight: 700;
    color: ${({ theme }) => theme.colors.text};
    text-align: center;
    margin-bottom: ${({ theme }) => theme.spacing.xs};
  `,

  UpdatedAt: styled.p`
    font-size: ${({ theme }) => theme.fontSizes.sm};
    color: ${({ theme }) => theme.colors.textMuted};
    text-align: center;
    margin-bottom: ${({ theme }) => theme.spacing['2xl']};
  `,

  BackLink: styled.button`
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
    font-size: ${({ theme }) => theme.fontSizes.sm};
    color: ${({ theme }) => theme.colors.textMuted};
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.xs};
    margin-bottom: ${({ theme }) => theme.spacing.lg};
    transition: color ${({ theme }) => theme.transitions.fast};
    &:hover { color: ${({ theme }) => theme.colors.text}; }
  `,

  BannerGroup: styled.div`
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.sm};
    margin-bottom: ${({ theme }) => theme.spacing.xl};
  `,

  Section: styled.section`
    margin-bottom: ${({ theme }) => theme.spacing.xl};
  `,

  SectionTitle: styled.h2`
    font-size: ${({ theme }) => theme.fontSizes.lg};
    font-weight: 700;
    color: ${({ theme }) => theme.colors.text};
    margin-bottom: ${({ theme }) => theme.spacing.sm};
  `,

  Paragraph: styled.p`
    font-size: ${({ theme }) => theme.fontSizes.md};
    color: ${({ theme }) => theme.colors.textSecondary};
    line-height: 1.7;
    margin-bottom: ${({ theme }) => theme.spacing.sm};
  `,

  List: styled.ul`
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.xs};
    margin: ${({ theme }) => theme.spacing.sm} 0 ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.lg};
  `,

  ListItem: styled.li`
    font-size: ${({ theme }) => theme.fontSizes.md};
    color: ${({ theme }) => theme.colors.textSecondary};
    line-height: 1.7;
  `,

  Divider: styled.hr`
    border: none;
    border-top: 1px solid ${({ theme }) => theme.colors.border};
    margin: ${({ theme }) => theme.spacing.xl} 0;
  `,

  ContactCard: styled.div`
    background: ${({ theme }) => theme.colors.cardHover};
    border-radius: ${({ theme }) => theme.borderRadius.md};
    padding: ${({ theme }) => theme.spacing.md};

    p {
      font-size: ${({ theme }) => theme.fontSizes.sm};
      color: ${({ theme }) => theme.colors.textSecondary};
      line-height: 1.7;
    }

    strong {
      color: ${({ theme }) => theme.colors.text};
    }
  `,
};
