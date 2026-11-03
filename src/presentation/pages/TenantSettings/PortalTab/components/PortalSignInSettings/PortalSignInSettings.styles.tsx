import styled from 'styled-components';

export const S = {
  Section: styled.section`
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.md};
    padding-top: ${({ theme }) => theme.spacing.lg};
    border-top: 1px solid ${({ theme }) => theme.colors.borderSubtle};
  `,

  Title: styled.h3`
    font-size: ${({ theme }) => theme.fontSizes.md};
    font-weight: 600;
    color: ${({ theme }) => theme.colors.text};
  `,

  Hint: styled.p`
    font-size: ${({ theme }) => theme.fontSizes.sm};
    color: ${({ theme }) => theme.colors.textMuted};
  `,

  Callback: styled.div`
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.sm};
    padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md};
    border: 1px dashed ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.borderRadius.md};
    font-family: ${({ theme }) => theme.fonts.mono};
    font-size: ${({ theme }) => theme.fontSizes.xs};
    color: ${({ theme }) => theme.colors.text};
    overflow-wrap: anywhere;
  `,

  Provider: styled.fieldset`
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: ${({ theme }) => theme.spacing.md};
    margin: 0;
    padding: ${({ theme }) => theme.spacing.md};
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.borderRadius.md};
    background: ${({ theme }) => theme.colors.surface};

    @media (max-width: 768px) {
      grid-template-columns: 1fr;
    }
  `,

  Field: styled.div`
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.xs};
  `,

  Wide: styled.div`
    grid-column: 1 / -1;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: ${({ theme }) => theme.spacing.md};
  `,

  List: styled.ul`
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.xs};
  `,

  Row: styled.li<{ $active: boolean }>`
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.sm};
    padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md};
    border: 1px solid ${({ theme, $active }) => ($active ? theme.colors.primary : theme.colors.border)};
    border-radius: ${({ theme }) => theme.borderRadius.md};
    background: ${({ theme }) => theme.colors.surface};
  `,

  RowText: styled.div`
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
  `,

  RowTitle: styled.span`
    font-size: ${({ theme }) => theme.fontSizes.sm};
    font-weight: 600;
    color: ${({ theme }) => theme.colors.text};
  `,

  RowMeta: styled.span`
    font-size: ${({ theme }) => theme.fontSizes.xs};
    color: ${({ theme }) => theme.colors.textMuted};
    overflow-wrap: anywhere;
  `,

  Actions: styled.div`
    display: flex;
    gap: ${({ theme }) => theme.spacing.sm};
  `,
};
