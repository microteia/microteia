import styled from 'styled-components';

export const S = {
  Container: styled.div`
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.md};
  `,

  Empty: styled.p`
    font-size: ${({ theme }) => theme.fontSizes.sm};
    color: ${({ theme }) => theme.colors.textMuted};
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

  Editor: styled.section`
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.sm};
    padding-top: ${({ theme }) => theme.spacing.md};
    border-top: 1px solid ${({ theme }) => theme.colors.borderSubtle};
  `,

  EditorTitle: styled.h3`
    font-size: ${({ theme }) => theme.fontSizes.md};
    font-weight: 600;
    color: ${({ theme }) => theme.colors.text};
  `,

  LocaleField: styled.div`
    max-width: 320px;
  `,

  /** Texto e pré-visualização lado a lado; um embaixo do outro numa tela estreita. */
  Panes: styled.div`
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: ${({ theme }) => theme.spacing.md};
    min-width: 0;

    @media (max-width: 900px) {
      grid-template-columns: 1fr;
    }
  `,

  Pane: styled.div`
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.xs};
    min-width: 0;
  `,

  Source: styled.textarea`
    min-height: 360px;
    resize: vertical;
    padding: ${({ theme }) => theme.spacing.sm};
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.borderRadius.md};
    background: ${({ theme }) => theme.colors.background};
    color: ${({ theme }) => theme.colors.text};
    font-family: ${({ theme }) => theme.fonts.mono};
    font-size: ${({ theme }) => theme.fontSizes.sm};
    line-height: 1.5;
  `,

  Preview: styled.div`
    min-height: 360px;
    max-height: 640px;
    overflow: auto;
    padding: ${({ theme }) => theme.spacing.md};
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.borderRadius.md};
    background: ${({ theme }) => theme.colors.surface};
  `,

  Counter: styled.span<{ $over: boolean }>`
    font-size: ${({ theme }) => theme.fontSizes.xs};
    color: ${({ theme, $over }) => ($over ? theme.colors.danger : theme.colors.textMuted)};
  `,

  Actions: styled.div`
    display: flex;
    flex-wrap: wrap;
    gap: ${({ theme }) => theme.spacing.sm};
  `,
};
