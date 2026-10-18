import styled from 'styled-components';

/**
 * Uma FOLHA sobre a mesa: a superfície do tema sobre o fundo, com a margem e a tipografia do documento
 * gerado — título centralizado, parágrafos justificados, tabela com grade. A ferramenta (o seletor e o
 * nome do arquivo) fica fora da folha, para a folha mostrar só o que o documento terá.
 */
export const S = {
  Body: styled.div`
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.md};
  `,

  Toolbar: styled.div`
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: ${({ theme }) => theme.spacing.md};
    flex-wrap: wrap;
  `,

  Field: styled.div`
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.xs};
    min-width: 280px;
    flex: 1;
  `,

  FileName: styled.div`
    display: inline-flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.xs};
    font-size: ${({ theme }) => theme.fontSizes.xs};
    color: ${({ theme }) => theme.colors.textMuted};
    padding: ${({ theme }) => theme.spacing.xs} ${({ theme }) => theme.spacing.sm};
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.borderRadius.full};
    white-space: nowrap;
  `,

  Desk: styled.div`
    background: ${({ theme }) => theme.colors.background};
    border: 1px solid ${({ theme }) => theme.colors.borderSubtle};
    border-radius: ${({ theme }) => theme.borderRadius.lg};
    padding: ${({ theme }) => theme.spacing.xl};
    max-height: 62vh;
    overflow-y: auto;
  `,

  Paper: styled.article`
    max-width: 760px;
    min-height: 320px;
    margin: 0 auto;
    padding: ${({ theme }) => theme.spacing['2xl']};
    background: ${({ theme }) => theme.colors.surface};
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.borderRadius.sm};
    box-shadow: 0 8px 28px ${({ theme }) => theme.colors.shadow};
    color: ${({ theme }) => theme.colors.text};
    font-size: ${({ theme }) => theme.fontSizes.sm};
    line-height: 1.7;

    h1 {
      text-align: center;
      font-size: ${({ theme }) => theme.fontSizes.xl};
      margin-bottom: ${({ theme }) => theme.spacing.lg};
    }

    h2, h3 {
      font-size: ${({ theme }) => theme.fontSizes.md};
      margin: ${({ theme }) => theme.spacing.lg} 0 ${({ theme }) => theme.spacing.sm};
    }

    p {
      text-align: justify;
      margin-bottom: ${({ theme }) => theme.spacing.sm};
    }

    ul, ol {
      padding-left: ${({ theme }) => theme.spacing.lg};
      margin-bottom: ${({ theme }) => theme.spacing.sm};
    }

    table {
      width: 100%;
      border-collapse: collapse;
      margin: ${({ theme }) => theme.spacing.sm} 0;
    }

    th, td {
      border: 1px solid ${({ theme }) => theme.colors.border};
      padding: ${({ theme }) => theme.spacing.xs} ${({ theme }) => theme.spacing.sm};
      text-align: left;
    }

    hr {
      border: none;
      border-top: 1px solid ${({ theme }) => theme.colors.border};
      margin: ${({ theme }) => theme.spacing.lg} 0;
    }
  `,

  PlainText: styled.div`
    white-space: pre-wrap;
  `,

  Center: styled.div`
    display: flex;
    justify-content: center;
    padding: ${({ theme }) => theme.spacing['2xl']};
  `,

  Gaps: styled.details`
    font-size: ${({ theme }) => theme.fontSizes.xs};
    color: ${({ theme }) => theme.colors.textSecondary};

    summary {
      cursor: pointer;
      color: ${({ theme }) => theme.colors.warning};
    }

    ul {
      margin-top: ${({ theme }) => theme.spacing.xs};
      padding-left: ${({ theme }) => theme.spacing.lg};
    }
  `,
};
