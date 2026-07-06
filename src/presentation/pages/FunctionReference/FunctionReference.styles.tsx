import styled from 'styled-components';

export const S = {
  Page: styled.div`
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
  `,

  Header: styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: ${({ theme }) => theme.spacing.lg} ${({ theme }) => theme.spacing.xl};
    border-bottom: 1px solid ${({ theme }) => theme.colors.border};
    flex-shrink: 0;
  `,

  Title: styled.h1`
    font-size: ${({ theme }) => theme.fontSizes.xl};
    font-weight: 700;
    color: ${({ theme }) => theme.colors.text};
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.sm};
  `,

  Content: styled.div`
    flex: 1;
    overflow-y: auto;
    padding: ${({ theme }) => theme.spacing.xl};

    &::-webkit-scrollbar { width: 6px; }
    &::-webkit-scrollbar-track { background: transparent; }
    &::-webkit-scrollbar-thumb {
      background: ${({ theme }) => theme.colors.scrollbarThumb};
      border-radius: 3px;
    }
  `,

  FilterContainer: styled.div`
    margin-bottom: ${({ theme }) => theme.spacing.lg};
  `,

  FunctionGrid: styled.div`
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: ${({ theme }) => theme.spacing.md};

    @media (min-width: 768px) {
      grid-template-columns: repeat(2, 1fr);
    }

    @media (min-width: 1200px) {
      grid-template-columns: repeat(3, 1fr);
    }
  `,

  FunctionCard: styled.div`
    padding: ${({ theme }) => theme.spacing.md};
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.borderRadius.md};
    background: ${({ theme }) => theme.colors.surface};
    display: flex;
    flex-direction: column;
    gap: 8px;
  `,

  FunctionHeader: styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 2px;
  `,

  FunctionName: styled.div`
    font-family: ${({ theme }) => theme.fonts.mono};
    font-size: 0.875rem;
    font-weight: 600;
    color: ${({ theme }) => theme.colors.primary};
  `,

  CategoryBadge: styled.div`
    font-size: 0.6875rem;
    font-weight: 600;
    color: ${({ theme }) => theme.colors.textSecondary};
    background: ${({ theme }) => theme.colors.inputBackground};
    padding: 2px 8px;
    border-radius: ${({ theme }) => theme.borderRadius.full};
    text-transform: uppercase;
    letter-spacing: 0.3px;
  `,

  Signature: styled.div`
    font-family: ${({ theme }) => theme.fonts.mono};
    font-size: 0.75rem;
    color: ${({ theme }) => theme.colors.textSecondary};
  `,

  Description: styled.div`
    font-size: 0.8125rem;
    color: ${({ theme }) => theme.colors.text};
  `,

  ExampleLabel: styled.div`
    font-size: 0.6875rem;
    font-weight: 600;
    color: ${({ theme }) => theme.colors.textSecondary};
    margin-top: 4px;
    text-transform: uppercase;
    letter-spacing: 0.3px;
  `,

  Example: styled.div`
    font-family: ${({ theme }) => theme.fonts.mono};
    font-size: 0.8125rem;
    color: ${({ theme }) => theme.colors.success};
    background: ${({ theme }) => theme.colors.inputBackground};
    padding: 8px 10px;
    border-radius: ${({ theme }) => theme.borderRadius.sm};
    border-left: 2px solid ${({ theme }) => theme.colors.success};
  `,

  EmptyState: styled.div`
    display: flex;
    align-items: center;
    justify-content: center;
    padding: ${({ theme }) => theme.spacing.xl};
    color: ${({ theme }) => theme.colors.textMuted};
    font-size: ${({ theme }) => theme.fontSizes.sm};
    text-align: center;
  `,
};
