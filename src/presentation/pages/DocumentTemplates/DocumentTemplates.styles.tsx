import styled from 'styled-components';

export type PillTone = 'primary' | 'warning';

/**
 * O vocabulário das outras listagens do produto (Relatórios, Automações, Scripts): cabeçalho com o
 * gesto de criar à direita, barra de filtro, e uma LINHA por item com as ações dela no fim.
 */
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
  `,

  Toolbar: styled.div`
    display: flex;
    gap: ${({ theme }) => theme.spacing.sm};
    padding: ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.spacing.xl};
    border-bottom: 1px solid ${({ theme }) => theme.colors.border};
    flex-shrink: 0;
    flex-wrap: wrap;
  `,

  Content: styled.div`
    flex: 1;
    overflow-y: auto;
    padding: ${({ theme }) => theme.spacing.lg} ${({ theme }) => theme.spacing.xl};
  `,

  List: styled.div`
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.sm};
  `,

  Row: styled.div`
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.md};
    background: ${({ theme }) => theme.colors.surface};
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.borderRadius.lg};
    padding: ${({ theme }) => theme.spacing.md};
    cursor: pointer;
    transition: ${({ theme }) => theme.transitions.fast};

    &:hover {
      border-color: ${({ theme }) => theme.colors.primary};
    }
  `,

  /** O Word em `info`, o texto em `primary`: o formato se lê antes do título. */
  FormatIcon: styled.div<{ $format: 'markdown' | 'docx' | 'text' }>`
    width: 36px;
    height: 36px;
    border-radius: ${({ theme }) => theme.borderRadius.md};
    background: ${({ theme, $format }) => ($format === 'docx' ? theme.colors.surfaceHover : theme.colors.primaryLight)};
    color: ${({ theme, $format }) => ($format === 'docx' ? theme.colors.info : theme.colors.primary)};
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  `,

  RowInfo: styled.div`
    flex: 1;
    min-width: 0;
  `,

  RowName: styled.div`
    font-size: ${({ theme }) => theme.fontSizes.md};
    font-weight: 600;
    color: ${({ theme }) => theme.colors.text};
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  `,

  RowDescription: styled.div`
    font-size: ${({ theme }) => theme.fontSizes.xs};
    color: ${({ theme }) => theme.colors.textMuted};
    margin-top: 2px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  `,

  Pill: styled.span<{ $tone: PillTone }>`
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px ${({ theme }) => theme.spacing.sm};
    border-radius: ${({ theme }) => theme.borderRadius.full};
    font-size: ${({ theme }) => theme.fontSizes.xs};
    font-weight: 500;
    white-space: nowrap;
    flex-shrink: 0;
    color: ${({ theme, $tone }) => ($tone === 'warning' ? theme.colors.warning : theme.colors.primary)};
    background: ${({ theme, $tone }) => ($tone === 'warning' ? theme.colors.warningLight : theme.colors.primaryLight)};
  `,

  Dot: styled.span`
    width: 6px;
    height: 6px;
    border-radius: ${({ theme }) => theme.borderRadius.full};
    background: currentColor;
  `,

  RowActions: styled.div`
    display: flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
  `,

  IconBtn: styled.button`
    width: 32px;
    height: 32px;
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
      background: ${({ theme }) => theme.colors.surfaceHover};
      color: ${({ theme }) => theme.colors.text};
      border-color: ${({ theme }) => theme.colors.primary};
    }
  `,

  DeleteBtn: styled.button`
    width: 32px;
    height: 32px;
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

  EmptyState: styled.div`
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: ${({ theme }) => theme.spacing.md};
    padding: ${({ theme }) => theme.spacing['2xl']};
    color: ${({ theme }) => theme.colors.textMuted};
    text-align: center;
  `,

  EmptyIcon: styled.div`
    font-size: 48px;
    opacity: 0.3;
  `,

  EmptyTitle: styled.div`
    font-size: ${({ theme }) => theme.fontSizes.md};
    font-weight: 600;
    color: ${({ theme }) => theme.colors.text};
  `,
};
