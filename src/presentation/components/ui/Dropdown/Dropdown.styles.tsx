import styled from 'styled-components';

export const S = {
  Container: styled.div`
    position: relative;
    display: inline-block;
  `,

  Trigger: styled.button`
    background: transparent;
    border: none;
    padding: 0;
    cursor: pointer;
    display: flex;
    align-items: center;
    color: ${({ theme }) => theme.colors.text};

    &:hover {
      opacity: 0.8;
    }
  `,

  // Ancorado à JANELA, e não ao card: o menu de um card no rodapé da lista era cortado pelo
  // contêiner que rola, e é o mesmo posicionamento que os seletores do kernel já usam.
  Menu: styled.div<{
    $top: number | null;
    $bottom: number | null;
    $left: number;
    $minWidth: number;
    $maxHeight: number;
  }>`
    position: fixed;
    top: ${({ $top }) => ($top != null ? `${$top}px` : 'auto')};
    bottom: ${({ $bottom }) => ($bottom != null ? `${$bottom}px` : 'auto')};
    left: ${({ $left }) => $left}px;
    min-width: ${({ $minWidth }) => $minWidth}px;
    max-height: ${({ $maxHeight }) => $maxHeight}px;
    background: ${({ theme }) => theme.colors.background};
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.borderRadius.md};
    box-shadow: 0 16px 48px ${({ theme }) => theme.colors.shadow};
    z-index: 9999;
    overflow-x: hidden;
    overflow-y: auto;
  `,

  MenuItem: styled.button<{ $variant?: 'default' | 'danger' }>`
    width: 100%;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem 1rem;
    background: transparent;
    border: none;
    cursor: pointer;
    font-size: 0.875rem;
    color: ${({ $variant, theme }) =>
      $variant === 'danger' ? theme.colors.danger : theme.colors.text};
    transition: background 0.2s;
    text-align: left;

    &:hover {
      background: ${({ theme }) => theme.colors.surface};
    }

    &:not(:last-child) {
      border-bottom: 1px solid ${({ theme }) => theme.colors.border};
    }
  `,

  MenuItemIcon: styled.span`
    display: flex;
    align-items: center;
    justify-content: center;
  `,

  MenuItemLabel: styled.span`
    flex: 1;
  `,
};
