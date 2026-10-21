import styled from 'styled-components';

const NARROW = '760px';

/** O mesmo desenho da navegação de Configurações: a lista à esquerda, o conteúdo ao lado. */
export const S = {
  Layout: styled.div`
    display: flex;
    gap: ${({ theme }) => theme.spacing.lg};
    align-items: flex-start;
    min-height: 0;

    @media (max-width: ${NARROW}) {
      flex-direction: column;
      gap: ${({ theme }) => theme.spacing.md};
    }
  `,

  Nav: styled.nav`
    width: 220px;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
    position: sticky;
    top: 0;

    @media (max-width: ${NARROW}) {
      width: 100%;
      flex-direction: row;
      overflow-x: auto;
      position: static;
    }
  `,

  Item: styled.button<{ $active: boolean }>`
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.sm};
    width: 100%;
    text-align: left;
    padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md};
    border-radius: ${({ theme }) => theme.borderRadius.md};
    font-size: ${({ theme }) => theme.fontSizes.sm};
    font-weight: ${({ $active }) => ($active ? 600 : 500)};
    color: ${({ $active, theme }) => ($active ? theme.colors.text : theme.colors.textSecondary)};
    background: ${({ $active, theme }) => ($active ? theme.colors.surfaceHover : 'transparent')};
    white-space: nowrap;
    transition: background ${({ theme }) => theme.transitions.fast}, color ${({ theme }) => theme.transitions.fast};

    &:hover {
      background: ${({ theme }) => theme.colors.surfaceHover};
      color: ${({ theme }) => theme.colors.text};
    }

    @media (max-width: ${NARROW}) {
      width: auto;
    }
  `,

  ItemIcon: styled.span`
    display: inline-flex;
    color: ${({ theme }) => theme.colors.textMuted};
  `,

  Content: styled.div`
    flex: 1;
    min-width: 0;
  `,
};
