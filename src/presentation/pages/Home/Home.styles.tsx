import styled from 'styled-components';

export const S = {
  Page: styled.div`
    min-height: 100vh;
    background: ${({ theme }) => theme.colors.background};
  `,

  Hero: styled.section`
    max-width: 1200px;
    margin: 0 auto;
    padding: ${({ theme }) => theme.spacing['2xl']} ${({ theme }) => theme.spacing.lg};
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing['2xl']};

    @media (max-width: 900px) {
      flex-direction: column;
      text-align: center;
    }
  `,

  HeroContent: styled.div`
    flex: 1;
    min-width: 0;
  `,

  Eyebrow: styled.span`
    display: inline-block;
    font-size: ${({ theme }) => theme.fontSizes.sm};
    font-weight: 700;
    color: ${({ theme }) => theme.colors.primary};
    text-transform: uppercase;
    letter-spacing: 0.08em;
    margin-bottom: ${({ theme }) => theme.spacing.sm};
  `,

  Title: styled.h1`
    font-size: ${({ theme }) => theme.fontSizes['3xl']};
    font-weight: 800;
    color: ${({ theme }) => theme.colors.text};
    line-height: 1.2;
    margin-bottom: ${({ theme }) => theme.spacing.md};
  `,

  Subtitle: styled.p`
    font-size: ${({ theme }) => theme.fontSizes.lg};
    color: ${({ theme }) => theme.colors.textSecondary};
    line-height: 1.6;
    margin-bottom: ${({ theme }) => theme.spacing.xl};
  `,

  HeroActions: styled.div`
    display: flex;
    gap: ${({ theme }) => theme.spacing.md};
    flex-wrap: wrap;

    @media (max-width: 900px) {
      justify-content: center;
    }
  `,

  PrimaryButton: styled.button`
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

  SecondaryButton: styled.button`
    background: none;
    color: ${({ theme }) => theme.colors.text};
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.borderRadius.md};
    padding: ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.spacing.xl};
    font-size: ${({ theme }) => theme.fontSizes.md};
    font-weight: 700;
    cursor: pointer;
    transition: border-color ${({ theme }) => theme.transitions.fast};

    &:hover {
      border-color: ${({ theme }) => theme.colors.primary};
      color: ${({ theme }) => theme.colors.primary};
    }
  `,

  HeroImage: styled.div`
    flex: 1;
    min-width: 0;

    img {
      width: 100%;
      border-radius: ${({ theme }) => theme.borderRadius.lg};
      border: 1px solid ${({ theme }) => theme.colors.border};
      box-shadow: 0 24px 64px ${({ theme }) => theme.colors.shadow};
    }
  `,

  Section: styled.section`
    max-width: 1200px;
    margin: 0 auto;
    padding: ${({ theme }) => theme.spacing['2xl']} ${({ theme }) => theme.spacing.lg};
  `,

  SectionTitle: styled.h2`
    font-size: ${({ theme }) => theme.fontSizes['2xl']};
    font-weight: 700;
    color: ${({ theme }) => theme.colors.text};
    text-align: center;
    margin-bottom: ${({ theme }) => theme.spacing.xl};
  `,

  ValueGrid: styled.div`
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: ${({ theme }) => theme.spacing.lg};

    @media (max-width: 900px) {
      grid-template-columns: 1fr;
    }
  `,

  ValueCard: styled.div`
    background: ${({ theme }) => theme.colors.surface};
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.borderRadius.lg};
    padding: ${({ theme }) => theme.spacing.lg};
  `,

  ValueTitle: styled.h3`
    font-size: ${({ theme }) => theme.fontSizes.lg};
    font-weight: 700;
    color: ${({ theme }) => theme.colors.text};
    margin-bottom: ${({ theme }) => theme.spacing.sm};
  `,

  ValueDescription: styled.p`
    font-size: ${({ theme }) => theme.fontSizes.sm};
    color: ${({ theme }) => theme.colors.textSecondary};
    line-height: 1.6;
  `,

  HighlightGrid: styled.div`
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: ${({ theme }) => theme.spacing.lg};
    margin-bottom: ${({ theme }) => theme.spacing.lg};

    @media (max-width: 900px) {
      grid-template-columns: 1fr;
    }
  `,

  HighlightCard: styled.div`
    background: ${({ theme }) => theme.colors.surface};
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.borderRadius.lg};
    overflow: hidden;
  `,

  HighlightImage: styled.div`
    width: 100%;
    aspect-ratio: 16 / 10;
    overflow: hidden;
    border-bottom: 1px solid ${({ theme }) => theme.colors.border};

    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      object-position: top;
    }
  `,

  HighlightTitle: styled.h3`
    font-size: ${({ theme }) => theme.fontSizes.md};
    font-weight: 700;
    color: ${({ theme }) => theme.colors.text};
    padding: ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.spacing.md} 0;
  `,

  HighlightDescription: styled.p`
    font-size: ${({ theme }) => theme.fontSizes.sm};
    color: ${({ theme }) => theme.colors.textSecondary};
    line-height: 1.6;
    padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.spacing.md};
  `,

  SectionLink: styled.button`
    display: block;
    margin: 0 auto;
    background: none;
    border: none;
    color: ${({ theme }) => theme.colors.primary};
    font-size: ${({ theme }) => theme.fontSizes.md};
    font-weight: 700;
    cursor: pointer;

    &:hover {
      color: ${({ theme }) => theme.colors.primaryHover};
    }
  `,

  PricingBand: styled.section`
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

  PricingBandText: styled.p`
    font-size: ${({ theme }) => theme.fontSizes.lg};
    font-weight: 600;
    color: ${({ theme }) => theme.colors.text};
  `,
};
