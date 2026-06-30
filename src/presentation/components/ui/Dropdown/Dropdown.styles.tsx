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

  Menu: styled.div<{ $align?: 'left' | 'right' }>`
    position: absolute;
    top: calc(100% + 0.5rem);
    ${({ $align }) => $align === 'right' ? 'right: 0;' : 'left: 0;'}
    min-width: 200px;
    background: ${({ theme }) => theme.colors.background};
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.borderRadius.md};
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    z-index: 1000;
    overflow: hidden;
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
