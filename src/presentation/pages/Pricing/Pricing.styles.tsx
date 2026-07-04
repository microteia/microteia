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

  PlanGrid: styled.section`
    max-width: 900px;
    margin: 0 auto;
    padding: 0 ${({ theme }) => theme.spacing.lg} ${({ theme }) => theme.spacing['2xl']};
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: ${({ theme }) => theme.spacing.lg};

    @media (max-width: 700px) {
      grid-template-columns: 1fr;
    }
  `,

  PlanCard: styled.div<{ $highlighted: boolean }>`
    background: ${({ theme }) => theme.colors.surface};
    border: 1px solid ${({ $highlighted, theme }) => ($highlighted ? theme.colors.primary : theme.colors.border)};
    border-radius: ${({ theme }) => theme.borderRadius.xl};
    padding: ${({ theme }) => theme.spacing.xl};
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.md};
  `,

  PlanName: styled.h2`
    font-size: ${({ theme }) => theme.fontSizes.lg};
    font-weight: 700;
    color: ${({ theme }) => theme.colors.text};
  `,

  PlanPrice: styled.div`
    display: flex;
    align-items: baseline;
    gap: ${({ theme }) => theme.spacing.xs};
  `,

  PlanPriceValue: styled.span`
    font-size: ${({ theme }) => theme.fontSizes['3xl']};
    font-weight: 800;
    color: ${({ theme }) => theme.colors.text};
  `,

  PlanPriceDetail: styled.span`
    font-size: ${({ theme }) => theme.fontSizes.sm};
    color: ${({ theme }) => theme.colors.textMuted};
  `,

  PlanDescription: styled.p`
    font-size: ${({ theme }) => theme.fontSizes.sm};
    color: ${({ theme }) => theme.colors.textSecondary};
    line-height: 1.6;
  `,

  PlanFeatureList: styled.ul`
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.sm};
  `,

  PlanFeatureItem: styled.li`
    font-size: ${({ theme }) => theme.fontSizes.sm};
    color: ${({ theme }) => theme.colors.textSecondary};
    line-height: 1.5;
    padding-left: ${({ theme }) => theme.spacing.md};
    position: relative;

    &::before {
      content: '✓';
      position: absolute;
      left: 0;
      color: ${({ theme }) => theme.colors.success};
      font-weight: 700;
    }
  `,

  PlanButton: styled.button<{ $highlighted: boolean }>`
    margin-top: auto;
    background: ${({ $highlighted, theme }) => ($highlighted ? theme.colors.primary : 'none')};
    color: ${({ $highlighted, theme }) => ($highlighted ? theme.colors.white : theme.colors.text)};
    border: 1px solid ${({ $highlighted, theme }) => ($highlighted ? theme.colors.primary : theme.colors.border)};
    border-radius: ${({ theme }) => theme.borderRadius.md};
    padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.lg};
    font-size: ${({ theme }) => theme.fontSizes.md};
    font-weight: 700;
    cursor: pointer;
    transition: background ${({ theme }) => theme.transitions.fast}, border-color ${({ theme }) => theme.transitions.fast};

    &:hover {
      background: ${({ $highlighted, theme }) => ($highlighted ? theme.colors.primaryHover : theme.colors.surfaceHover)};
      border-color: ${({ theme }) => theme.colors.primary};
    }
  `,
};
