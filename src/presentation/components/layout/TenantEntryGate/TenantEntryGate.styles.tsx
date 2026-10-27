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

  Organization: styled.div`
    font-size: ${({ theme }) => theme.fontSizes.sm};
    color: ${({ theme }) => theme.colors.textSecondary};
  `,

  Lead: styled.p`
    margin: 0;
    font-size: ${({ theme }) => theme.fontSizes.sm};
    line-height: 1.5;
    color: ${({ theme }) => theme.colors.textSecondary};
  `,

  Form: styled.form`
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.sm};
  `,

  CodeInput: styled.input`
    width: 100%;
    padding: 12px 14px;
    background: ${({ theme }) => theme.colors.inputBackground};
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.borderRadius.md};
    color: ${({ theme }) => theme.colors.text};
    font-family: ${({ theme }) => theme.fonts.mono};
    font-size: ${({ theme }) => theme.fontSizes.lg};
    letter-spacing: 0.2em;
    text-align: center;

    &:focus {
      outline: none;
      border-color: ${({ theme }) => theme.colors.primary};
    }
  `,

  Error: styled.div`
    font-size: ${({ theme }) => theme.fontSizes.sm};
    color: ${({ theme }) => theme.colors.danger};
  `,

  Actions: styled.div`
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: ${({ theme }) => theme.spacing.sm};
  `,

  LinkButton: styled.button`
    padding: 0;
    border: none;
    background: none;
    cursor: pointer;
    font-size: ${({ theme }) => theme.fontSizes.sm};
    color: ${({ theme }) => theme.colors.primary};

    &:hover { text-decoration: underline; }
  `,

  Footer: styled.div`
    display: flex;
    flex-wrap: wrap;
    gap: ${({ theme }) => theme.spacing.sm};
    padding-top: ${({ theme }) => theme.spacing.md};
    border-top: 1px solid ${({ theme }) => theme.colors.borderSubtle};
  `,

  QrFrame: styled.div`
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 200px;
  `,

  QrImage: styled.img`
    width: 200px;
    height: 200px;
    image-rendering: pixelated;
    border-radius: ${({ theme }) => theme.borderRadius.sm};
  `,

  Secret: styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: ${({ theme }) => theme.spacing.sm};
    padding: 10px 14px;
    background: ${({ theme }) => theme.colors.inputBackground};
    border-radius: ${({ theme }) => theme.borderRadius.md};
    font-family: ${({ theme }) => theme.fonts.mono};
    font-size: ${({ theme }) => theme.fontSizes.sm};
    color: ${({ theme }) => theme.colors.text};
    word-break: break-all;
  `,

  SecretLabel: styled.div`
    font-size: ${({ theme }) => theme.fontSizes.xs};
    color: ${({ theme }) => theme.colors.textMuted};
  `,

  Link: styled.a`
    font-size: ${({ theme }) => theme.fontSizes.sm};
    color: ${({ theme }) => theme.colors.primary};
  `,

  Codes: styled.ol`
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: ${({ theme }) => theme.spacing.xs} ${({ theme }) => theme.spacing.md};
    margin: 0;
    padding: ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.spacing.lg};
    background: ${({ theme }) => theme.colors.inputBackground};
    border-radius: ${({ theme }) => theme.borderRadius.md};
    font-family: ${({ theme }) => theme.fonts.mono};
    font-size: ${({ theme }) => theme.fontSizes.sm};
    color: ${({ theme }) => theme.colors.text};
  `,

  CodesTools: styled.div`
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.sm};
  `,

  ModalBody: styled.div`
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.md};
    padding: ${({ theme }) => theme.spacing.xl};
  `,

  PendingBar: styled.div`
    position: fixed;
    left: 50%;
    bottom: ${({ theme }) => theme.spacing.lg};
    transform: translateX(-50%);
    z-index: 900;
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.md};
    padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md};
    background: ${({ theme }) => theme.colors.surface};
    border: 1px solid ${({ theme }) => theme.colors.warning};
    border-radius: ${({ theme }) => theme.borderRadius.md};
    box-shadow: 0 8px 24px ${({ theme }) => theme.colors.shadow};
    font-size: ${({ theme }) => theme.fontSizes.sm};
    color: ${({ theme }) => theme.colors.text};
  `,
};
