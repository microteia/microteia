import styled from 'styled-components';

export const S = {
  Container: styled.div<{ $focused: boolean }>`
    position: relative;
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 4px;
    min-height: 40px;
    padding: 4px 10px;
    background: ${({ theme }) => theme.colors.inputBackground};
    border: 1.5px solid ${({ theme, $focused }) =>
      $focused ? theme.colors.primary : theme.colors.border};
    border-radius: ${({ theme }) => theme.borderRadius.md};
    cursor: text;
    transition: border-color ${({ theme }) => theme.transitions.fast};
    flex: 1;
    min-width: 240px;
  `,

  FilterIcon: styled.span`
    display: flex;
    align-items: center;
    color: ${({ theme }) => theme.colors.textMuted};
    flex-shrink: 0;
    pointer-events: none;
  `,

  TokensRow: styled.div`
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 4px;
    flex: 1;
    min-width: 0;
  `,

  Chip: styled.div`
    display: inline-flex;
    align-items: center;
    gap: 3px;
    padding: 2px 4px 2px 8px;
    background: ${({ theme }) => theme.colors.primaryLight};
    border: 1px solid ${({ theme }) => theme.colors.primary}33;
    border-radius: ${({ theme }) => theme.borderRadius.full};
    font-size: 12px;
    flex-shrink: 0;
    animation: chipIn 120ms ease;

    @keyframes chipIn {
      from { opacity: 0; transform: scale(0.85); }
      to   { opacity: 1; transform: scale(1); }
    }
  `,

  ChipValuePill: styled.span`
    display: inline-flex;
    align-items: center;
    gap: 2px;
    padding: 1px 2px 1px 5px;
    background: ${({ theme }) => theme.colors.primary}1a;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 500;
    color: ${({ theme }) => theme.colors.text};
    white-space: nowrap;
    flex-shrink: 0;
  `,

  ChipPillRemove: styled.button`
    display: flex;
    align-items: center;
    justify-content: center;
    width: 13px;
    height: 13px;
    color: ${({ theme }) => theme.colors.textMuted};
    border-radius: 50%;
    flex-shrink: 0;
    transition:
      color ${({ theme }) => theme.transitions.fast},
      background ${({ theme }) => theme.transitions.fast};

    &:hover {
      color: ${({ theme }) => theme.colors.danger};
      background: ${({ theme }) => theme.colors.danger}22;
    }
  `,

  ChipBody: styled.div`
    display: flex;
    align-items: center;
    gap: 3px;
    cursor: pointer;
    transition: opacity ${({ theme }) => theme.transitions.fast};

    &:hover { opacity: 0.72; }
  `,

  ChipColorDot: styled.span<{ $color: string }>`
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: ${({ $color }) => $color};
    flex-shrink: 0;
  `,

  ChipKey: styled.span`
    color: ${({ theme }) => theme.colors.textMuted};
    font-weight: 500;
    margin-right: 1px;
  `,

  ChipValue: styled.span`
    color: ${({ theme }) => theme.colors.text};
    font-weight: 500;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 140px;
  `,

  ChipRemove: styled.button`
    display: flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    color: ${({ theme }) => theme.colors.textMuted};
    border-radius: 50%;
    flex-shrink: 0;
    margin-left: 1px;
    transition:
      color ${({ theme }) => theme.transitions.fast},
      background ${({ theme }) => theme.transitions.fast};

    &:hover {
      color: ${({ theme }) => theme.colors.danger};
      background: ${({ theme }) => theme.colors.danger}22;
    }
  `,

  ActiveDefBadge: styled.span`
    display: inline-flex;
    align-items: center;
    padding: 2px 8px 2px 8px;
    background: ${({ theme }) => theme.colors.primary}1a;
    border: 1px solid ${({ theme }) => theme.colors.primary}44;
    border-radius: ${({ theme }) => theme.borderRadius.full};
    font-size: 12px;
    font-weight: 600;
    color: ${({ theme }) => theme.colors.primary};
    flex-shrink: 0;
    white-space: nowrap;
  `,

  Input: styled.input`
    flex: 1;
    min-width: 80px;
    border: none;
    outline: none;
    background: transparent;
    font-size: ${({ theme }) => theme.fontSizes.sm};
    color: ${({ theme }) => theme.colors.text};
    font-family: ${({ theme }) => theme.fonts.body};
    padding: 2px 0;

    &::placeholder { color: ${({ theme }) => theme.colors.textMuted}; }
  `,

  SaveBtn: styled.button`
    display: flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    color: ${({ theme }) => theme.colors.textMuted};
    border-radius: 50%;
    flex-shrink: 0;
    transition:
      color ${({ theme }) => theme.transitions.fast},
      background ${({ theme }) => theme.transitions.fast};

    &:hover {
      color: ${({ theme }) => theme.colors.primary};
      background: ${({ theme }) => theme.colors.primaryLight};
    }
  `,

  ClearAll: styled.button`
    display: flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    color: ${({ theme }) => theme.colors.textMuted};
    border-radius: 50%;
    flex-shrink: 0;
    transition: color ${({ theme }) => theme.transitions.fast},
      background ${({ theme }) => theme.transitions.fast};

    &:hover {
      color: ${({ theme }) => theme.colors.text};
      background: ${({ theme }) => theme.colors.surfaceHover};
    }
  `,

  Dropdown: styled.div`
    position: absolute;
    top: calc(100% + 6px);
    left: 0;
    right: 0;
    min-width: 260px;
    max-height: min(480px, 70vh);
    display: flex;
    flex-direction: column;
    background: ${({ theme }) => theme.colors.surface};
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.borderRadius.md};
    box-shadow: 0 16px 48px ${({ theme }) => theme.colors.shadow};
    z-index: 300;
    overflow: hidden;
    animation: dropIn 130ms ease;

    @keyframes dropIn {
      from { opacity: 0; transform: translateY(-6px); }
      to   { opacity: 1; transform: translateY(0); }
    }
  `,

  PortalDropdown: styled.div<{ $top: number; $left: number; $minWidth: number }>`
    position: fixed;
    top: ${({ $top }) => $top}px;
    left: ${({ $left }) => $left}px;
    min-width: ${({ $minWidth }) => $minWidth}px;
    max-height: min(480px, 70vh);
    display: flex;
    flex-direction: column;
    background: ${({ theme }) => theme.colors.surface};
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.borderRadius.md};
    box-shadow: 0 16px 48px ${({ theme }) => theme.colors.shadow};
    z-index: 9999;
    overflow: hidden;
    animation: cfDropIn 130ms ease;

    @keyframes cfDropIn {
      from { opacity: 0; transform: translateY(-6px); }
      to   { opacity: 1; transform: translateY(0); }
    }
  `,

  DropdownHeader: styled.div`
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 14px;
    font-size: 11px;
    font-weight: 600;
    color: ${({ theme }) => theme.colors.textMuted};
    text-transform: uppercase;
    letter-spacing: 0.07em;
    border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  `,

  OptionList: styled.ul`
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 4px 0;
  `,

  OptionItem: styled.li<{ $active: boolean; $selected?: boolean }>`
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 9px 14px;
    cursor: pointer;
    font-size: ${({ theme }) => theme.fontSizes.sm};
    color: ${({ theme, $selected }) =>
      $selected ? theme.colors.primary : theme.colors.text};
    background: ${({ theme, $active, $selected }) =>
      $selected
        ? theme.colors.primaryLight
        : $active
        ? theme.colors.surfaceHover
        : 'transparent'};
    transition: background ${({ theme }) => theme.transitions.fast};

    &:hover { background: ${({ theme }) => theme.colors.surfaceHover}; }
  `,

  OptionColorDot: styled.span<{ $color: string }>`
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: ${({ $color }) => $color};
    flex-shrink: 0;
  `,

  OptionLabel: styled.span`
    flex: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  `,

  OptionTypeBadge: styled.span`
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: ${({ theme }) => theme.colors.textMuted};
    background: ${({ theme }) => theme.colors.surfaceHover};
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: 4px;
    padding: 1px 5px;
    flex-shrink: 0;
  `,

  CheckMark: styled.span`
    display: flex;
    align-items: center;
    color: ${({ theme }) => theme.colors.primary};
    flex-shrink: 0;
  `,

  TextHint: styled.div`
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 14px;
    font-size: ${({ theme }) => theme.fontSizes.sm};
    color: ${({ theme }) => theme.colors.textMuted};
    font-style: italic;
  `,

  DropdownFooter: styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 8px 14px;
    border-top: 1px solid ${({ theme }) => theme.colors.border};
  `,

  FooterCount: styled.span`
    font-size: 12px;
    color: ${({ theme }) => theme.colors.textMuted};
  `,

  FooterActions: styled.div`
    display: flex;
    align-items: center;
    gap: 8px;
  `,

  FooterBtn: styled.button<{ $variant?: 'primary' | 'ghost' }>`
    font-size: 12px;
    font-weight: 600;
    padding: 4px 10px;
    border-radius: ${({ theme }) => theme.borderRadius.sm};
    transition: background ${({ theme }) => theme.transitions.fast};
    color: ${({ theme, $variant }) =>
      $variant === 'primary' ? theme.colors.primary : theme.colors.textMuted};
    background: ${({ theme, $variant }) =>
      $variant === 'primary' ? theme.colors.primaryLight : 'transparent'};

    &:hover {
      background: ${({ theme, $variant }) =>
        $variant === 'primary'
          ? `${theme.colors.primary}33`
          : theme.colors.surfaceHover};
      color: ${({ theme }) => theme.colors.text};
    }
  `,

  EmptyMsg: styled.div`
    padding: 20px 14px;
    text-align: center;
    color: ${({ theme }) => theme.colors.textMuted};
    font-size: ${({ theme }) => theme.fontSizes.sm};
  `,

  SavedSection: styled.div`
    border-bottom: 1px solid ${({ theme }) => theme.colors.border};
    padding: 4px 0;
  `,

  SavedHeader: styled.div`
    padding: 6px 14px 2px;
    font-size: 10px;
    font-weight: 600;
    color: ${({ theme }) => theme.colors.textMuted};
    text-transform: uppercase;
    letter-spacing: 0.07em;
  `,

  SavedList: styled.ul`
    max-height: 130px;
    overflow-y: auto;
    padding: 2px 0;
  `,

  SavedItem: styled.li`
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 2px 8px 2px 14px;
    transition: background ${({ theme }) => theme.transitions.fast};

    &:hover { background: ${({ theme }) => theme.colors.surfaceHover}; }
  `,

  SavedItemApply: styled.button`
    display: flex;
    align-items: center;
    gap: 6px;
    flex: 1;
    padding: 6px 0;
    font-size: ${({ theme }) => theme.fontSizes.sm};
    color: ${({ theme }) => theme.colors.text};
    text-align: left;
    cursor: pointer;
    overflow: hidden;
  `,

  SavedItemIcon: styled.span`
    display: flex;
    align-items: center;
    color: ${({ theme }) => theme.colors.textMuted};
    flex-shrink: 0;
  `,

  SavedItemName: styled.span`
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  `,

  SavedItemRemove: styled.button`
    display: flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    color: ${({ theme }) => theme.colors.textMuted};
    border-radius: 50%;
    flex-shrink: 0;
    transition:
      color ${({ theme }) => theme.transitions.fast},
      background ${({ theme }) => theme.transitions.fast};

    &:hover {
      color: ${({ theme }) => theme.colors.danger};
      background: ${({ theme }) => theme.colors.danger}22;
    }
  `,

  SaveBar: styled.div`
    display: flex;
    align-items: center;
    gap: 6px;
    flex: 1;
  `,

  SaveInput: styled.input`
    flex: 1;
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.borderRadius.sm};
    background: ${({ theme }) => theme.colors.inputBackground};
    color: ${({ theme }) => theme.colors.text};
    font-size: ${({ theme }) => theme.fontSizes.sm};
    font-family: ${({ theme }) => theme.fonts.body};
    padding: 3px 8px;
    outline: none;
    min-width: 0;

    &:focus { border-color: ${({ theme }) => theme.colors.primary}; }
    &::placeholder { color: ${({ theme }) => theme.colors.textMuted}; }
  `,
};
