import styled from 'styled-components';

export const S = {
  Dock: styled.aside<{ $hidden: boolean }>`
    position: relative;
    display: ${({ $hidden }) => ($hidden ? 'none' : 'flex')};
    flex-direction: column;
    flex-shrink: 0;
    min-width: 0;
    height: 100%;
    background: ${({ theme }) => theme.colors.surface};
    border-left: 1px solid ${({ theme }) => theme.colors.border};
  `,

  ResizeHandle: styled.div<{ $active: boolean }>`
    position: absolute;
    top: 0;
    left: -3px;
    width: 6px;
    height: 100%;
    cursor: col-resize;
    z-index: 2;
    background: ${({ theme, $active }) => ($active ? theme.colors.primary : 'transparent')};
    transition: background ${({ theme }) => theme.transitions.fast};

    &:hover {
      background: ${({ theme }) => theme.colors.primaryLight};
    }
  `,

  Header: styled.div`
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.xs};
    min-height: 40px;
    padding: 0 ${({ theme }) => theme.spacing.sm};
    border-bottom: 1px solid ${({ theme }) => theme.colors.borderSubtle};
  `,

  Tabs: styled.div`
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.xs};
    flex: 1;
    min-width: 0;
    overflow-x: auto;
  `,

  Tab: styled.button<{ $active: boolean }>`
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.xs};
    padding: ${({ theme }) => theme.spacing.xs} ${({ theme }) => theme.spacing.sm};
    border-radius: ${({ theme }) => theme.borderRadius.sm};
    font-size: ${({ theme }) => theme.fontSizes.sm};
    font-weight: ${({ $active }) => ($active ? 600 : 500)};
    color: ${({ theme, $active }) => ($active ? theme.colors.text : theme.colors.textMuted)};
    background: ${({ theme, $active }) => ($active ? theme.colors.surfaceHover : 'transparent')};
    white-space: nowrap;

    &:hover {
      color: ${({ theme }) => theme.colors.text};
    }
  `,

  Title: styled.span`
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.xs};
    flex: 1;
    min-width: 0;
    font-size: ${({ theme }) => theme.fontSizes.sm};
    font-weight: 600;
    color: ${({ theme }) => theme.colors.text};
  `,

  CloseButton: styled.button`
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: ${({ theme }) => theme.borderRadius.sm};
    color: ${({ theme }) => theme.colors.textMuted};

    &:hover {
      color: ${({ theme }) => theme.colors.text};
      background: ${({ theme }) => theme.colors.surfaceHover};
    }
  `,

  Body: styled.div`
    position: relative;
    flex: 1;
    min-height: 0;
  `,

  Panel: styled.div<{ $hidden: boolean }>`
    position: absolute;
    inset: 0;
    display: ${({ $hidden }) => ($hidden ? 'none' : 'flex')};
    flex-direction: column;
    min-height: 0;
  `,

  Loading: styled.div`
    display: flex;
    align-items: center;
    justify-content: center;
    flex: 1;
  `,

  Failure: styled.div`
    padding: ${({ theme }) => theme.spacing.md};
    font-size: ${({ theme }) => theme.fontSizes.sm};
    color: ${({ theme }) => theme.colors.danger};
  `,
};
