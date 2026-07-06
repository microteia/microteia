import styled from 'styled-components';

export const S = {
  Content: styled.div`
    display: flex;
    flex-direction: column;
    gap: 16px;
    max-height: 60vh;
    overflow-y: auto;

    &::-webkit-scrollbar { width: 6px; }
    &::-webkit-scrollbar-track { background: transparent; }
    &::-webkit-scrollbar-thumb {
      background: ${({ theme }) => theme.colors.scrollbarThumb};
      border-radius: 3px;
    }
  `,

  Section: styled.div`
    display: flex;
    flex-direction: column;
    gap: 12px;
  `,

  SectionTitle: styled.h3`
    font-size: 0.875rem;
    font-weight: 600;
    color: ${({ theme }) => theme.colors.textSecondary};
    margin: 0;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  `,

  FunctionCard: styled.div`
    padding: 12px;
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.borderRadius.md};
    background: ${({ theme }) => theme.colors.surface};
  `,

  FunctionHeader: styled.div`
    display: flex;
    align-items: baseline;
    gap: 8px;
    margin-bottom: 6px;
  `,

  FunctionName: styled.div`
    font-family: ${({ theme }) => theme.fonts.mono};
    font-size: 0.875rem;
    font-weight: 600;
    color: ${({ theme }) => theme.colors.primary};
  `,

  Signature: styled.div`
    font-family: ${({ theme }) => theme.fonts.mono};
    font-size: 0.75rem;
    color: ${({ theme }) => theme.colors.textSecondary};
  `,

  Description: styled.div`
    font-size: 0.8125rem;
    color: ${({ theme }) => theme.colors.text};
    margin-bottom: 8px;
  `,

  ExampleLabel: styled.div`
    font-size: 0.6875rem;
    font-weight: 600;
    color: ${({ theme }) => theme.colors.textSecondary};
    margin-bottom: 4px;
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

  OperatorsInfo: styled.div`
    padding: 12px;
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.borderRadius.md};
    background: ${({ theme }) => theme.colors.surface};
  `,

  OperatorList: styled.div`
    display: flex;
    flex-direction: column;
    gap: 6px;
    font-size: 0.8125rem;
    color: ${({ theme }) => theme.colors.text};
    font-family: ${({ theme }) => theme.fonts.body};
  `,

  OperatorItem: styled.div`
    display: flex;
    gap: 8px;
    align-items: baseline;
  `,

  OperatorSymbol: styled.code`
    font-family: ${({ theme }) => theme.fonts.mono};
    font-size: 0.875rem;
    background: ${({ theme }) => theme.colors.inputBackground};
    padding: 2px 6px;
    border-radius: ${({ theme }) => theme.borderRadius.sm};
    color: ${({ theme }) => theme.colors.primary};
    font-weight: 600;
  `,
};
