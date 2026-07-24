import styled from 'styled-components';

export const S = {
  Fields: styled.div`
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: ${({ theme }) => theme.spacing.md};
    margin-bottom: ${({ theme }) => theme.spacing.md};
  `,

  Field: styled.label`
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.xs};
    font-size: ${({ theme }) => theme.fontSizes.sm};
    font-weight: 500;
    color: ${({ theme }) => theme.colors.textSecondary};
  `,

  Input: styled.input`
    padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md};
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.borderRadius.sm};
    background: ${({ theme }) => theme.colors.background};
    color: ${({ theme }) => theme.colors.text};
    font-size: ${({ theme }) => theme.fontSizes.sm};

    &:focus { outline: none; border-color: ${({ theme }) => theme.colors.primary}; }
  `,

  Toolbar: styled.div`
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.md};
    margin-bottom: ${({ theme }) => theme.spacing.sm};
    flex-wrap: wrap;
  `,

  Error: styled.span`
    font-size: ${({ theme }) => theme.fontSizes.xs};
    color: ${({ theme }) => theme.colors.warning};
  `,

  Split: styled.div`
    height: 62vh;
    min-height: 320px;
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.borderRadius.md};
    overflow: hidden;
  `,

  PreviewPane: styled.div`
    height: 100%;
    overflow: auto;
    background: ${({ theme }) => theme.colors.background};
  `,
};
