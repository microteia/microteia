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
    gap: ${({ theme }) => theme.spacing.md};
    padding: ${({ theme }) => theme.spacing.lg} ${({ theme }) => theme.spacing.xl};
    border-bottom: 1px solid ${({ theme }) => theme.colors.border};
    flex-shrink: 0;
  `,

  HeaderTitle: styled.div`
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.sm};
    font-size: ${({ theme }) => theme.fontSizes.lg};
    font-weight: 700;
    color: ${({ theme }) => theme.colors.text};
  `,

  HeaderActions: styled.div`
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.sm};
  `,

  Content: styled.div`
    flex: 1;
    overflow-y: auto;
    padding: ${({ theme }) => theme.spacing.lg} ${({ theme }) => theme.spacing.xl};
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.xl};
  `,

  Section: styled.section`
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.sm};
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.borderRadius.lg};
    padding: ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.spacing.lg};
  `,

  SectionHeader: styled.button`
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.sm};
    width: 100%;
    background: transparent;
    border: none;
    padding: 0;
    cursor: pointer;
    text-align: left;
    color: ${({ theme }) => theme.colors.text};
  `,

  SectionChevron: styled.span<{ $open: boolean }>`
    display: inline-flex;
    align-items: center;
    color: ${({ theme }) => theme.colors.textMuted};
    transition: ${({ theme }) => theme.transitions.fast};
    transform: rotate(${({ $open }) => ($open ? '90deg' : '0deg')});
  `,

  SectionTitle: styled.h2`
    font-size: ${({ theme }) => theme.fontSizes.md};
    font-weight: 600;
    color: ${({ theme }) => theme.colors.text};
  `,

  SectionBody: styled.div`
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.sm};
  `,

  SectionHint: styled.p`
    font-size: ${({ theme }) => theme.fontSizes.xs};
    color: ${({ theme }) => theme.colors.textMuted};
  `,

  Field: styled.div`
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.xs};
  `,

  CodeArea: styled.textarea`
    width: 100%;
    min-height: 320px;
    resize: vertical;
    padding: ${({ theme }) => theme.spacing.md};
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.borderRadius.md};
    background: ${({ theme }) => theme.colors.surface};
    color: ${({ theme }) => theme.colors.text};
    font-family: ${({ theme }) => theme.fonts.mono};
    font-size: ${({ theme }) => theme.fontSizes.sm};
    line-height: 1.6;
    tab-size: 2;

    &:focus {
      outline: none;
      border-color: ${({ theme }) => theme.colors.primary};
    }
  `,

  OutputRows: styled.div`
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.sm};
  `,

  OutputRow: styled.div`
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.xs};
  `,

  OutputGrid: styled.div`
    display: grid;
    grid-template-columns: 1fr 1fr minmax(160px, 1fr) auto;
    gap: ${({ theme }) => theme.spacing.sm};
    align-items: end;
  `,

  OutputSubLine: styled.div`
    display: grid;
    grid-template-columns: minmax(220px, 1fr);
    gap: ${({ theme }) => theme.spacing.sm};
  `,

  Cell: styled.div`
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.xs};
    min-width: 0;
  `,

  Error: styled.span`
    font-size: ${({ theme }) => theme.fontSizes.xs};
    color: ${({ theme }) => theme.colors.danger};
  `,

  Empty: styled.div`
    font-size: ${({ theme }) => theme.fontSizes.sm};
    color: ${({ theme }) => theme.colors.textMuted};
    padding: ${({ theme }) => theme.spacing.sm} 0;
  `,

  RemoveBtn: styled.button`
    width: 38px;
    height: 38px;
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
      color: ${({ theme }) => theme.colors.surface};
      border-color: ${({ theme }) => theme.colors.danger};
    }
  `,

  AddBtn: styled.button`
    display: inline-flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.xs};
    align-self: flex-start;
    padding: ${({ theme }) => theme.spacing.xs} ${({ theme }) => theme.spacing.md};
    border-radius: ${({ theme }) => theme.borderRadius.md};
    border: 1px dashed ${({ theme }) => theme.colors.border};
    background: transparent;
    color: ${({ theme }) => theme.colors.primary};
    font-size: ${({ theme }) => theme.fontSizes.sm};
    cursor: pointer;
    transition: ${({ theme }) => theme.transitions.fast};

    &:hover {
      border-color: ${({ theme }) => theme.colors.primary};
    }
  `,
};
