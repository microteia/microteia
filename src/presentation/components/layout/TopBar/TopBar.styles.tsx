import styled, { keyframes, css } from 'styled-components';

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(-4px); }
  to   { opacity: 1; transform: translateY(0); }
`;

const dropdownOpen = keyframes`
  from { opacity: 0; transform: translateY(-6px) scale(0.97); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
`;

const spin = keyframes`
  to { transform: rotate(360deg); }
`;

export const S = {
  Bar: styled.header`
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 48px;
    padding: 0 ${({ theme }) => theme.spacing.lg};
    background: ${({ theme }) => theme.colors.surface};
    border-bottom: 1px solid ${({ theme }) => theme.colors.border};
    flex-shrink: 0;
    animation: ${fadeIn} 200ms ease;
  `,

  Left: styled.div`
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.sm};
    min-width: 0;
    position: relative;
  `,

  Right: styled.div`
    display: flex;
    align-items: center;
    gap: 4px;
  `,

  TenantChip: styled.button<{ $clickable: boolean; $switching: boolean }>`
    display: flex;
    align-items: center;
    gap: 6px;
    height: 28px;
    padding: 0 10px;
    border-radius: ${({ theme }) => theme.borderRadius.md};
    background: ${({ theme }) => theme.colors.primaryLight};
    color: ${({ theme }) => theme.colors.primary};
    font-size: ${({ theme }) => theme.fontSizes.sm};
    font-weight: 600;
    max-width: 420px;
    transition: background ${({ theme }) => theme.transitions.fast},
                color ${({ theme }) => theme.transitions.fast},
                opacity ${({ theme }) => theme.transitions.fast};
    opacity: ${({ $switching }) => ($switching ? 0.6 : 1)};
    cursor: ${({ $clickable }) => ($clickable ? 'pointer' : 'default')};

    ${({ $clickable, theme }) =>
      $clickable &&
      css`
        &:hover {
          background: ${theme.colors.primary};
          color: #fff;
        }
      `}
  `,

  TenantName: styled.span`
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    max-width: 360px;
  `,

  ChevronIcon: styled.span<{ $open: boolean }>`
    display: flex;
    align-items: center;
    flex-shrink: 0;
    transition: transform 200ms ease;
    transform: ${({ $open }) => ($open ? 'rotate(180deg)' : 'rotate(0deg)')};
  `,

  SpinnerIcon: styled.span`
    display: flex;
    align-items: center;
    flex-shrink: 0;
    animation: ${spin} 0.7s linear infinite;
  `,

  Dropdown: styled.div`
    position: absolute;
    top: calc(100% + 6px);
    left: 0;
    min-width: 220px;
    max-width: 320px;
    background: ${({ theme }) => theme.colors.surface};
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.borderRadius.md};
    box-shadow: 0 8px 24px ${({ theme }) => theme.colors.shadow};
    overflow: hidden;
    z-index: 1000;
    animation: ${dropdownOpen} 150ms ease;
  `,

  DropdownHeader: styled.div`
    padding: 8px 12px 6px;
    font-size: ${({ theme }) => theme.fontSizes.xs};
    font-weight: 600;
    color: ${({ theme }) => theme.colors.textMuted};
    text-transform: uppercase;
    letter-spacing: 0.06em;
    border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  `,

  SearchInputWrapper: styled.div`
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    border-bottom: 1px solid ${({ theme }) => theme.colors.border};
    color: ${({ theme }) => theme.colors.textMuted};
  `,

  SearchInput: styled.input`
    flex: 1;
    border: none;
    background: transparent;
    color: ${({ theme }) => theme.colors.text};
    font-size: ${({ theme }) => theme.fontSizes.sm};
    font-family: inherit;
    outline: none;

    &::placeholder {
      color: ${({ theme }) => theme.colors.textMuted};
    }
  `,

  EmptyState: styled.div`
    padding: 24px 12px;
    text-align: center;
    font-size: ${({ theme }) => theme.fontSizes.sm};
    color: ${({ theme }) => theme.colors.textMuted};
  `,

  DropdownItem: styled.button<{ $active: boolean }>`
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 10px 12px;
    font-size: ${({ theme }) => theme.fontSizes.sm};
    font-weight: ${({ $active }) => ($active ? '600' : '400')};
    color: ${({ theme, $active }) => ($active ? theme.colors.primary : theme.colors.text)};
    background: ${({ theme, $active }) => ($active ? theme.colors.primaryLight : 'transparent')};
    text-align: left;
    transition: background ${({ theme }) => theme.transitions.fast},
                color ${({ theme }) => theme.transitions.fast};

    &:hover {
      background: ${({ theme }) => theme.colors.surfaceHover};
      color: ${({ theme }) => theme.colors.text};
    }
  `,

  DropdownItemName: styled.span`
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    flex: 1;
  `,

  DropdownItemCheck: styled.span`
    display: flex;
    align-items: center;
    flex-shrink: 0;
    color: ${({ theme }) => theme.colors.primary};
  `,

  IconButton: styled.button<{ $active?: boolean }>`
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 34px;
    height: 34px;
    border-radius: ${({ theme }) => theme.borderRadius.md};
    color: ${({ theme, $active }) => ($active ? theme.colors.primary : theme.colors.textMuted)};
    background: ${({ theme, $active }) => ($active ? theme.colors.primaryLight : 'transparent')};
    transition: all ${({ theme }) => theme.transitions.fast};

    &:hover {
      color: ${({ theme }) => theme.colors.text};
      background: ${({ theme }) => theme.colors.surfaceHover};
    }
  `,

  Badge: styled.span`
    position: absolute;
    top: 3px;
    right: 3px;
    min-width: 16px;
    height: 16px;
    padding: 0 4px;
    border-radius: 8px;
    background: ${({ theme }) => theme.colors.primary};
    color: #fff;
    font-size: 10px;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: none;
    border: 2px solid ${({ theme }) => theme.colors.surface};
  `,
};
