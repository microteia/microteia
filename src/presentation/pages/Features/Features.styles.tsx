import styled from 'styled-components';

export const S = {
  Page: styled.div`
    min-height: 100vh;
    background: ${({ theme }) => theme.colors.background};
  `,

  Intro: styled.section`
    max-width: 800px;
    margin: 0 auto;
    padding: ${({ theme }) => theme.spacing['2xl']} ${({ theme }) => theme.spacing.lg} ${({ theme }) => theme.spacing.lg};
    text-align: center;
  `,

  Title: styled.h1`
    font-size: ${({ theme }) => theme.fontSizes['3xl']};
    font-weight: 800;
    color: ${({ theme }) => theme.colors.text};
    margin-bottom: ${({ theme }) => theme.spacing.md};
  `,

  Subtitle: styled.p`
    font-size: ${({ theme }) => theme.fontSizes.lg};
    color: ${({ theme }) => theme.colors.textSecondary};
  `,

  SectionList: styled.div`
    max-width: 1100px;
    margin: 0 auto;
    padding: 0 ${({ theme }) => theme.spacing.lg} ${({ theme }) => theme.spacing['2xl']};
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing['2xl']};
  `,

  FeatureRow: styled.div<{ $reverse: boolean }>`
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.xl};
    flex-direction: ${({ $reverse }) => ($reverse ? 'row-reverse' : 'row')};

    @media (max-width: 800px) {
      flex-direction: column;
      text-align: center;
    }
  `,

  FeatureImage: styled.div`
    flex: 1;
    min-width: 0;

    img {
      width: 100%;
      border-radius: ${({ theme }) => theme.borderRadius.lg};
      border: 1px solid ${({ theme }) => theme.colors.border};
      box-shadow: 0 16px 40px ${({ theme }) => theme.colors.shadow};
    }
  `,

  FeatureText: styled.div`
    flex: 1;
    min-width: 0;
  `,

  FeatureTitle: styled.h2`
    font-size: ${({ theme }) => theme.fontSizes.xl};
    font-weight: 700;
    color: ${({ theme }) => theme.colors.text};
    margin-bottom: ${({ theme }) => theme.spacing.sm};
  `,

  FeatureDescription: styled.p`
    font-size: ${({ theme }) => theme.fontSizes.md};
    color: ${({ theme }) => theme.colors.textSecondary};
    line-height: 1.7;
  `,

  CtaBand: styled.section`
    background: ${({ theme }) => theme.colors.surface};
    border-top: 1px solid ${({ theme }) => theme.colors.border};
    border-bottom: 1px solid ${({ theme }) => theme.colors.border};
    padding: ${({ theme }) => theme.spacing.xl} ${({ theme }) => theme.spacing.lg};
    display: flex;
    align-items: center;
    justify-content: center;
    gap: ${({ theme }) => theme.spacing.lg};
    flex-wrap: wrap;
    text-align: center;
  `,

  CtaText: styled.p`
    font-size: ${({ theme }) => theme.fontSizes.lg};
    font-weight: 600;
    color: ${({ theme }) => theme.colors.text};
  `,

  CtaButton: styled.button`
    background: ${({ theme }) => theme.colors.primary};
    color: ${({ theme }) => theme.colors.white};
    border: none;
    border-radius: ${({ theme }) => theme.borderRadius.md};
    padding: ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.spacing.xl};
    font-size: ${({ theme }) => theme.fontSizes.md};
    font-weight: 700;
    cursor: pointer;
    transition: background ${({ theme }) => theme.transitions.fast};

    &:hover {
      background: ${({ theme }) => theme.colors.primaryHover};
    }
  `,
};
