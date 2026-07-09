import styled from 'styled-components';

export const S = {
  Container: styled.div`
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.md};
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.borderRadius.md};
    padding: ${({ theme }) => theme.spacing.md};
    background: ${({ theme }) => theme.colors.surface};
  `,

  Section: styled.div`
    display: flex;
    flex-direction: column;
    gap: 6px;
  `,

  SectionTitle: styled.span`
    font-size: ${({ theme }) => theme.fontSizes.xs};
    font-weight: 600;
    color: ${({ theme }) => theme.colors.textMuted};
    text-transform: uppercase;
    letter-spacing: 0.04em;
  `,

  FilterRow: styled.div`
    display: grid;
    grid-template-columns: 1fr 140px 1fr auto;
    gap: ${({ theme }) => theme.spacing.sm};
    align-items: start;

    @media (max-width: 560px) {
      grid-template-columns: 1fr;
    }
  `,

  OrderRow: styled.div`
    display: grid;
    grid-template-columns: 1fr 140px auto;
    gap: ${({ theme }) => theme.spacing.sm};
    align-items: start;

    @media (max-width: 560px) {
      grid-template-columns: 1fr;
    }
  `,

  ValueEditor: styled.div`
    display: flex;
    flex-direction: column;
    gap: 4px;
  `,

  KindRow: styled.div`
    display: grid;
    grid-template-columns: 130px 1fr;
    gap: ${({ theme }) => theme.spacing.sm};
    align-items: start;
  `,

  LimitRow: styled.div`
    display: grid;
    grid-template-columns: 120px;
    gap: ${({ theme }) => theme.spacing.sm};
  `,

  AddButton: styled.button`
    align-self: flex-start;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    border-radius: ${({ theme }) => theme.borderRadius.md};
    border: 1px dashed ${({ theme }) => theme.colors.border};
    background: transparent;
    color: ${({ theme }) => theme.colors.primary};
    font-size: ${({ theme }) => theme.fontSizes.xs};
    cursor: pointer;
    transition: ${({ theme }) => theme.transitions.fast};

    &:hover {
      border-color: ${({ theme }) => theme.colors.primary};
    }
  `,

  RemoveButton: styled.button`
    width: 34px;
    height: 34px;
    border-radius: ${({ theme }) => theme.borderRadius.md};
    border: 1px solid ${({ theme }) => theme.colors.border};
    background: ${({ theme }) => theme.colors.surface};
    color: ${({ theme }) => theme.colors.textMuted};
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    flex-shrink: 0;
    transition: ${({ theme }) => theme.transitions.fast};

    &:hover {
      background: ${({ theme }) => theme.colors.danger};
      color: ${({ theme }) => theme.colors.white};
      border-color: ${({ theme }) => theme.colors.danger};
    }
  `,

  Issue: styled.span`
    font-size: ${({ theme }) => theme.fontSizes.xs};
    color: ${({ theme }) => theme.colors.danger};
  `,

  Empty: styled.p`
    font-size: ${({ theme }) => theme.fontSizes.xs};
    color: ${({ theme }) => theme.colors.textMuted};
    margin: 0;
  `,
};
