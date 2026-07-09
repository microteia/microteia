import styled from 'styled-components';

export const Wrapper = styled.div`
  position: relative;
`;

export const TriggerButton = styled.button<{
  $hasValue: boolean;
  $disabled?: boolean;
  $multiSelect?: boolean;
}>`
  width: 100%;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: ${({ $multiSelect }) => $multiSelect ? '8px 12px' : '10px 14px'};
  min-height: ${({ $multiSelect }) => $multiSelect ? '42px' : 'auto'};
  flex-wrap: ${({ $multiSelect }) => $multiSelect ? 'wrap' : 'nowrap'};
  background: ${({ theme }) => theme.colors.inputBackground};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  color: ${({ theme, $hasValue }) => $hasValue ? theme.colors.text : theme.colors.textMuted};
  font-size: ${({ theme }) => theme.fontSizes.sm};
  text-align: left;
  transition: border-color ${({ theme }) => theme.transitions.fast};
  cursor: ${({ $disabled }) => $disabled ? 'not-allowed' : 'pointer'};
  opacity: ${({ $disabled }) => $disabled ? 0.5 : 1};

  &:focus {
    outline: none;
    border-color: ${({ theme }) => theme.colors.primary};
  }

  &:hover:not(:disabled) {
    border-color: ${({ theme, $disabled }) => !$disabled ? theme.colors.primary : theme.colors.border};
  }
`;

export const ColorDot = styled.span<{ $color: string }>`
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: ${({ $color }) => $color};
  flex-shrink: 0;
`;

export const SelectedPills = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  flex: 1;
  min-width: 0;
`;

export const SelectedPill = styled.span<{ $color?: string }>`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 7px;
  border-radius: ${({ theme }) => theme.borderRadius.full};
  font-size: 11px;
  font-weight: 500;
  background: ${({ theme, $color }) => $color ? `${$color}22` : theme.colors.surfaceHover};
  color: ${({ theme, $color }) => $color ?? theme.colors.text};
  border: 1px solid ${({ $color }) => $color ? `${$color}44` : 'transparent'};
  white-space: nowrap;
  flex-shrink: 0;
`;

export const TriggerLabel = styled.span`
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

export const TriggerRight = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
  margin-left: auto;
  flex-shrink: 0;
`;

export const ClearBtn = styled.span`
  display: flex;
  align-items: center;
  color: ${({ theme }) => theme.colors.textMuted};
  padding: 2px;
  border-radius: 50%;
  transition: color ${({ theme }) => theme.transitions.fast};
  flex-shrink: 0;
  cursor: pointer;

  &:hover { color: ${({ theme }) => theme.colors.text}; }
`;

export const ChevronIcon = styled.span<{ $open: boolean }>`
  display: flex;
  align-items: center;
  color: ${({ theme }) => theme.colors.textMuted};
  transition: transform 200ms ease;
  transform: rotate(${({ $open }) => $open ? '180deg' : '0deg'});
`;

export const Dropdown = styled.div<{ $top: number | null; $bottom: number | null; $left: number; $minWidth: number; $maxHeight: number }>`
  position: fixed;
  top: ${({ $top }) => ($top != null ? `${$top}px` : 'auto')};
  bottom: ${({ $bottom }) => ($bottom != null ? `${$bottom}px` : 'auto')};
  left: ${({ $left }) => $left}px;
  min-width: ${({ $minWidth }) => $minWidth}px;
  width: max-content;
  max-width: 420px;
  max-height: ${({ $maxHeight }) => $maxHeight}px;
  display: flex;
  flex-direction: column;
  background: ${({ theme }) => theme.colors.surface};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  box-shadow: 0 12px 32px ${({ theme }) => theme.colors.shadow};
  z-index: 9999;
  overflow: hidden;
  animation: dropIn 120ms ease;

  @keyframes dropIn {
    from { opacity: 0; transform: translateY(-6px); }
    to   { opacity: 1; transform: translateY(0); }
  }
`;

export const SearchRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  color: ${({ theme }) => theme.colors.textMuted};
  flex-shrink: 0;
`;

export const SearchInput = styled.input`
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  font-size: ${({ theme }) => theme.fontSizes.sm};
  color: ${({ theme }) => theme.colors.text};

  &::placeholder { color: ${({ theme }) => theme.colors.textMuted}; }
`;

export const OptionList = styled.ul`
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
`;

export const DeleteBtn = styled.button`
  display: flex;
  align-items: center;
  padding: 2px 4px;
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  color: ${({ theme }) => theme.colors.textMuted};
  opacity: 0;
  transition:
    opacity 150ms ease,
    color 150ms ease,
    background 150ms ease;
  flex-shrink: 0;

  &:hover {
    color: ${({ theme }) => theme.colors.danger};
    background: ${({ theme }) => theme.colors.dangerLight};
  }
`;

export const OptionItem = styled.li<{ $active: boolean; $selected: boolean }>`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  cursor: pointer;
  font-size: ${({ theme }) => theme.fontSizes.sm};
  color: ${({ theme, $selected }) => $selected ? theme.colors.primary : theme.colors.text};
  background: ${({ theme, $active, $selected }) =>
    $selected ? theme.colors.primaryLight :
    $active   ? theme.colors.surfaceHover :
    'transparent'};
  transition: background ${({ theme }) => theme.transitions.fast};

  &:hover {
    background: ${({ theme }) => theme.colors.surfaceHover};
  }

  &:hover ${DeleteBtn} {
    opacity: 1;
  }
`;

export const OptionText = styled.div`
  flex: 1;
  min-width: 0;
`;

export const OptionLabel = styled.div`
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

export const OptionMeta = styled.div`
  font-size: ${({ theme }) => theme.fontSizes.xs};
  color: ${({ theme }) => theme.colors.textMuted};
  margin-top: 1px;
`;

export const CheckIcon = styled.span`
  color: ${({ theme }) => theme.colors.primary};
  flex-shrink: 0;
  display: flex;
  align-items: center;
`;

export const AddRow = styled.li<{ $active: boolean }>`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 14px;
  cursor: pointer;
  font-size: ${({ theme }) => theme.fontSizes.xs};
  color: ${({ theme }) => theme.colors.textMuted};
  border-top: 1px solid ${({ theme }) => theme.colors.border};
  background: ${({ theme, $active }) => $active ? theme.colors.surfaceHover : 'transparent'};
  transition: background ${({ theme }) => theme.transitions.fast}, color ${({ theme }) => theme.transitions.fast};

  &:hover {
    background: ${({ theme }) => theme.colors.surfaceHover};
    color: ${({ theme }) => theme.colors.primary};
  }
`;

export const AddLabel = styled.span`
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

export const AddQueryText = styled.span`
  font-weight: 500;
  font-style: italic;
`;

export const EmptyMsg = styled.div`
  padding: 20px 14px;
  text-align: center;
  color: ${({ theme }) => theme.colors.textMuted};
  font-size: ${({ theme }) => theme.fontSizes.sm};
`;
