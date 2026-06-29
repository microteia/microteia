import styled from 'styled-components';

export const S = {
  Page: styled.div`
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: ${({ theme }) => theme.colors.background};
    padding: ${({ theme }) => theme.spacing.md};
  `,

  Card: styled.div`
    background: ${({ theme }) => theme.colors.surface};
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.borderRadius.xl};
    padding: ${({ theme }) => theme.spacing['2xl']};
    width: 100%;
    max-width: 420px;
    text-align: center;
    box-shadow: 0 24px 64px ${({ theme }) => theme.colors.shadow};
  `,

  Logo: styled.div`
    width: 80px;
    height: 80px;
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
    font-size: ${({ theme }) => theme.fontSizes['3xl']};
    font-weight: 700;
    color: ${({ theme }) => theme.colors.text};
    margin-bottom: ${({ theme }) => theme.spacing.sm};
  `,

  Subtitle: styled.p`
    font-size: ${({ theme }) => theme.fontSizes.md};
    color: ${({ theme }) => theme.colors.textSecondary};
    margin-bottom: ${({ theme }) => theme.spacing['2xl']};
    line-height: 1.5;
  `,

  Divider: styled.div`
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.md};
    margin: ${({ theme }) => theme.spacing.lg} 0;
    color: ${({ theme }) => theme.colors.textMuted};
    font-size: ${({ theme }) => theme.fontSizes.sm};
    &::before, &::after {
      content: '';
      flex: 1;
      height: 1px;
      background: ${({ theme }) => theme.colors.border};
    }
  `,

  Features: styled.ul`
    text-align: left;
    margin-bottom: ${({ theme }) => theme.spacing.xl};
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.sm};
  `,

  FeatureItem: styled.li`
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.sm};
    font-size: ${({ theme }) => theme.fontSizes.sm};
    color: ${({ theme }) => theme.colors.textSecondary};
    &::before {
      content: '✓';
      color: ${({ theme }) => theme.colors.success};
      font-weight: 700;
    }
  `,

  Form: styled.div`
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.md};
    text-align: left;
  `,

  InputGroup: styled.div`
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.xs};
  `,

  Label: styled.label`
    font-size: ${({ theme }) => theme.fontSizes.sm};
    font-weight: 500;
    color: ${({ theme }) => theme.colors.textSecondary};
  `,

  ForgotPasswordLink: styled.button`
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
    font-size: ${({ theme }) => theme.fontSizes.sm};
    color: ${({ theme }) => theme.colors.primary};
    text-align: right;
    align-self: flex-end;
    transition: opacity ${({ theme }) => theme.transitions.fast};
    &:hover { opacity: 0.75; }
  `,

  SwitchModeText: styled.p`
    font-size: ${({ theme }) => theme.fontSizes.sm};
    color: ${({ theme }) => theme.colors.textMuted};
    text-align: center;
    margin-top: ${({ theme }) => theme.spacing.sm};
  `,

  SwitchModeLink: styled.button`
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
    font-size: ${({ theme }) => theme.fontSizes.sm};
    color: ${({ theme }) => theme.colors.primary};
    font-weight: 600;
    transition: opacity ${({ theme }) => theme.transitions.fast};
    &:hover { opacity: 0.75; }
  `,

  BackLink: styled.button`
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
    font-size: ${({ theme }) => theme.fontSizes.sm};
    color: ${({ theme }) => theme.colors.textMuted};
    align-self: flex-start;
    margin-bottom: ${({ theme }) => theme.spacing.md};
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.xs};
    transition: color ${({ theme }) => theme.transitions.fast};
    &:hover { color: ${({ theme }) => theme.colors.text}; }
  `,

  VerifyEmailIcon: styled.div`
    font-size: ${({ theme }) => theme.fontSizes['3xl']};
    margin: 0 auto ${({ theme }) => theme.spacing.md};
    color: ${({ theme }) => theme.colors.primary};
    display: flex;
    align-items: center;
    justify-content: center;
  `,

  VerifyEmailText: styled.p`
    font-size: ${({ theme }) => theme.fontSizes.sm};
    color: ${({ theme }) => theme.colors.textSecondary};
    line-height: 1.6;
    margin-bottom: ${({ theme }) => theme.spacing.lg};

    strong {
      color: ${({ theme }) => theme.colors.text};
    }
  `,

  SuccessMessage: styled.p`
    color: ${({ theme }) => theme.colors.success};
    font-size: ${({ theme }) => theme.fontSizes.sm};
    margin-top: ${({ theme }) => theme.spacing.md};
    text-align: center;
  `,

  ErrorMessage: styled.p`
    color: ${({ theme }) => theme.colors.danger};
    font-size: ${({ theme }) => theme.fontSizes.sm};
    margin-top: ${({ theme }) => theme.spacing.md};
    text-align: center;
  `,

  ButtonGroup: styled.div`
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.sm};
  `,
};
