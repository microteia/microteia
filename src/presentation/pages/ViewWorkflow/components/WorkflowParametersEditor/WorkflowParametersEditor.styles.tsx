import styled from 'styled-components';

export const S = {
  Container: styled.div`
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.md};
  `,

  Empty: styled.p`
    margin: 0;
    color: ${({ theme }) => theme.colors.textSecondary};
    font-size: ${({ theme }) => theme.fontSizes.sm};
  `,

  Row: styled.div`
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.sm};
    padding: ${({ theme }) => theme.spacing.md};
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.borderRadius.lg};
    background: ${({ theme }) => theme.colors.surface};
  `,

  RowHeader: styled.div`
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.sm};
  `,

  CollapseBtn: styled.button`
    width: 22px;
    height: 22px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    border-radius: ${({ theme }) => theme.borderRadius.sm};
    background: transparent;
    color: ${({ theme }) => theme.colors.textMuted};
    cursor: pointer;
    flex-shrink: 0;
    transition: ${({ theme }) => theme.transitions.fast};

    &:hover {
      color: ${({ theme }) => theme.colors.primary};
      background: ${({ theme }) => theme.colors.primaryLight};
    }
  `,

  Summary: styled.button`
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.xs};
    border: none;
    background: transparent;
    padding: 0;
    text-align: left;
    cursor: pointer;
    font-size: ${({ theme }) => theme.fontSizes.sm};
    color: ${({ theme }) => theme.colors.text};
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  `,

  HeaderTitle: styled.span`
    flex: 1;
    min-width: 0;
    font-size: ${({ theme }) => theme.fontSizes.sm};
    font-weight: 600;
    color: ${({ theme }) => theme.colors.text};
  `,

  Line: styled.div`
    display: grid;
    grid-template-columns: 1.4fr 1.4fr 1.2fr auto;
    gap: ${({ theme }) => theme.spacing.sm};
    align-items: start;
  `,

  SubLine: styled.div`
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: ${({ theme }) => theme.spacing.sm};
    align-items: start;
  `,

  Cell: styled.div`
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
  `,

  Error: styled.span`
    color: ${({ theme }) => theme.colors.danger};
    font-size: ${({ theme }) => theme.fontSizes.xs};
  `,

  RemoveBtn: styled.button`
    display: flex;
    align-items: center;
    justify-content: center;
    width: 34px;
    height: 34px;
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.borderRadius.md};
    background: ${({ theme }) => theme.colors.surface};
    color: ${({ theme }) => theme.colors.danger};
    cursor: pointer;
    transition: background ${({ theme }) => theme.transitions.fast};

    &:hover {
      background: ${({ theme }) => theme.colors.background};
    }
  `,

  CloneBtn: styled.button`
    display: flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    border: none;
    border-radius: ${({ theme }) => theme.borderRadius.sm};
    background: transparent;
    color: ${({ theme }) => theme.colors.textMuted};
    cursor: pointer;
    flex-shrink: 0;
    transition: ${({ theme }) => theme.transitions.fast};

    &:hover {
      color: ${({ theme }) => theme.colors.primary};
      background: ${({ theme }) => theme.colors.primaryLight};
    }
  `,

  OptionsBox: styled.div`
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.xs};
  `,

  NestedBox: styled.div`
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.sm};
    margin-left: ${({ theme }) => theme.spacing.md};
    padding-left: ${({ theme }) => theme.spacing.md};
    border-left: 2px solid ${({ theme }) => theme.colors.border};
  `,

  NestedLabel: styled.span`
    font-size: ${({ theme }) => theme.fontSizes.xs};
    font-weight: 600;
    color: ${({ theme }) => theme.colors.textSecondary};
  `,

  OptionRow: styled.div`
    display: flex;
    gap: ${({ theme }) => theme.spacing.sm};
    align-items: center;
  `,

  AddBtn: styled.button`
    display: inline-flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.xs};
    align-self: flex-start;
    padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md};
    border: 1px dashed ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.borderRadius.md};
    background: transparent;
    color: ${({ theme }) => theme.colors.primary};
    font-size: ${({ theme }) => theme.fontSizes.sm};
    cursor: pointer;
    transition: border-color ${({ theme }) => theme.transitions.fast};

    &:hover {
      border-color: ${({ theme }) => theme.colors.primary};
    }
  `,
};
