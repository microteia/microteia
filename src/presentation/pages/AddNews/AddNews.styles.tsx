import styled from 'styled-components';

export const S = {
  Page: styled.div`
    padding: ${({ theme }) => theme.spacing.lg};
    max-width: 860px;
    margin: 0 auto;
  `,

  Header: styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: ${({ theme }) => theme.spacing.lg};
  `,

  Title: styled.h2`
    font-size: ${({ theme }) => theme.fontSizes['2xl']};
    font-weight: 700;
    color: ${({ theme }) => theme.colors.text};
    margin: 0;
  `,

  Form: styled.div`
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.lg};
  `,

  FormGrid: styled.div`
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: ${({ theme }) => theme.spacing.md};

    @media (max-width: 640px) {
      grid-template-columns: 1fr;
    }
  `,

  FormFullRow: styled.div`
    grid-column: 1 / -1;
  `,

  EditorWrapper: styled.div`
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.borderRadius.md};
    overflow: hidden;
    min-height: 320px;
  `,

  ScopeRow: styled.div`
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.sm};
  `,

  ScopeToggle: styled.button<{ $active?: boolean }>`
    font-size: ${({ theme }) => theme.fontSizes.sm};
    font-weight: 500;
    padding: 6px 14px;
    border-radius: ${({ theme }) => theme.borderRadius.full};
    border: 1px solid ${({ $active, theme }) => $active ? theme.colors.primary : theme.colors.border};
    background: ${({ $active, theme }) => $active ? theme.colors.primaryLight : 'transparent'};
    color: ${({ $active, theme }) => $active ? theme.colors.primary : theme.colors.textMuted};
    cursor: pointer;
    transition: all ${({ theme }) => theme.transitions.fast};

    &:hover {
      border-color: ${({ theme }) => theme.colors.primary};
      color: ${({ theme }) => theme.colors.primary};
    }
  `,

  Actions: styled.div`
    display: flex;
    justify-content: flex-end;
    gap: ${({ theme }) => theme.spacing.sm};
    padding-top: ${({ theme }) => theme.spacing.md};
    border-top: 1px solid ${({ theme }) => theme.colors.border};
  `,
};
