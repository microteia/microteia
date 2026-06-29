import styled from 'styled-components';

export const S = {
  Body: styled.div`
    display: flex;
    flex-direction: column;
    gap: 12px;
    width: 100%;
    overflow-x: hidden;
  `,

  Toolbar: styled.div`
    display: flex;
    align-items: center;
    gap: 8px;
  `,

  SearchWrapper: styled.div`
    flex: 1;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    background: ${({ theme }) => theme.colors.inputBackground};
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.borderRadius.md};
    color: ${({ theme }) => theme.colors.textMuted};
    transition: border-color ${({ theme }) => theme.transitions.fast};
    &:focus-within {
      border-color: ${({ theme }) => theme.colors.primary};
      color: ${({ theme }) => theme.colors.textSecondary};
    }
  `,

  SearchInput: styled.input`
    flex: 1;
    background: transparent;
    border: none;
    outline: none;
    color: ${({ theme }) => theme.colors.text};
    font-size: ${({ theme }) => theme.fontSizes.sm};
    &::placeholder { color: ${({ theme }) => theme.colors.textMuted}; }
  `,

  AddTagBtn: styled.button`
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 8px 12px;
    background: ${({ theme }) => theme.colors.primaryLight};
    color: ${({ theme }) => theme.colors.primary};
    border: 1px solid ${({ theme }) => `${theme.colors.primary}30`};
    border-radius: ${({ theme }) => theme.borderRadius.md};
    font-size: ${({ theme }) => theme.fontSizes.sm};
    font-weight: 500;
    flex-shrink: 0;
    white-space: nowrap;
    transition: background ${({ theme }) => theme.transitions.fast};
    &:hover { background: ${({ theme }) => `${theme.colors.primary}22`}; }
  `,

  FormBox: styled.div`
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 14px;
    background: ${({ theme }) => theme.colors.surfaceHover};
    border-radius: ${({ theme }) => theme.borderRadius.md};
    border: 1px solid ${({ theme }) => theme.colors.border};
  `,

  FormHeader: styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
  `,

  FormLabel: styled.label`
    font-size: ${({ theme }) => theme.fontSizes.xs};
    font-weight: 600;
    color: ${({ theme }) => theme.colors.textSecondary};
    text-transform: uppercase;
    letter-spacing: 0.06em;
  `,

  NameInput: styled.input`
    width: 100%;
    box-sizing: border-box;
    padding: 8px 12px;
    background: ${({ theme }) => theme.colors.inputBackground};
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.borderRadius.md};
    color: ${({ theme }) => theme.colors.text};
    font-size: ${({ theme }) => theme.fontSizes.sm};
    outline: none;
    transition: border-color ${({ theme }) => theme.transitions.fast};
    &::placeholder { color: ${({ theme }) => theme.colors.textMuted}; }
    &:focus { border-color: ${({ theme }) => theme.colors.primary}; }
  `,

  ColorPalette: styled.div`
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  `,

  ColorSwatch: styled.button<{ $color: string; $selected: boolean }>`
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: ${({ $color }) => $color};
    border: 3px solid ${({ $selected, theme }) =>
      $selected ? theme.colors.text : 'transparent'};
    outline: 2px solid ${({ $selected, $color }) => $selected ? $color : 'transparent'};
    outline-offset: 1px;
    transition: transform 150ms ease, outline 150ms ease;
    cursor: pointer;
    &:hover { transform: scale(1.15); }
  `,

  FormActions: styled.div`
    display: flex;
    gap: ${({ theme }) => theme.spacing.sm};
    justify-content: flex-end;
  `,

  TagList: styled.div`
    display: flex;
    flex-direction: column;
    gap: 2px;
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    overflow-x: hidden;
    scrollbar-width: thin;
    scrollbar-color: ${({ theme }) => theme.colors.scrollbarThumb} transparent;
    &::-webkit-scrollbar { width: 4px; }
    &::-webkit-scrollbar-track { background: transparent; }
    &::-webkit-scrollbar-thumb {
      background: ${({ theme }) => theme.colors.scrollbarThumb};
      border-radius: 4px;
    }
  `,

  TagRowWrapper: styled.div<{ $editing?: boolean }>`
    display: flex;
    align-items: center;
    gap: 6px;
    border-radius: ${({ theme }) => theme.borderRadius.md};
    background: ${({ theme, $editing }) =>
      $editing ? theme.colors.primaryLight : 'transparent'};
    transition: background ${({ theme }) => theme.transitions.fast};
    &:hover > *:last-child { opacity: 1; }
  `,

  TagRow: styled.div`
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.sm};
    padding: 8px 10px;
    border-radius: ${({ theme }) => theme.borderRadius.md};
    cursor: pointer;
    flex: 1;
    transition: background ${({ theme }) => theme.transitions.fast};
    &:hover { background: ${({ theme }) => theme.colors.surfaceHover}; }
  `,

  TagCheck: styled.div<{ $checked: boolean; $color: string }>`
    width: 16px;
    height: 16px;
    border-radius: 4px;
    border: 2px solid ${({ $color }) => $color};
    background: ${({ $checked, $color }) => $checked ? $color : 'transparent'};
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 150ms ease;
    color: #fff;
    font-size: 10px;
  `,

  TagPill: styled.span<{ $color: string }>`
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 3px 9px;
    border-radius: 10px;
    font-size: 12px;
    font-weight: 500;
    background: ${({ $color }) => `${$color}20`};
    color: ${({ $color }) => $color};
    border: 1px solid ${({ $color }) => `${$color}40`};
    flex: 1;
    min-width: 0;
  `,

  PillDot: styled.span<{ $color: string }>`
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: ${({ $color }) => $color};
    flex-shrink: 0;
  `,

  TagName: styled.span`
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  `,

  TagActions: styled.div`
    display: flex;
    gap: 2px;
    flex-shrink: 0;
    opacity: 0;
    transition: opacity ${({ theme }) => theme.transitions.fast};
  `,

  ActionBtn: styled.button`
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border-radius: ${({ theme }) => theme.borderRadius.sm};
    color: ${({ theme }) => theme.colors.textMuted};
    transition: all ${({ theme }) => theme.transitions.fast};
    &:hover {
      background: ${({ theme }) => theme.colors.surfaceHover};
      color: ${({ theme }) => theme.colors.text};
    }
  `,

  DangerBtn: styled.button`
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border-radius: ${({ theme }) => theme.borderRadius.sm};
    color: ${({ theme }) => theme.colors.textMuted};
    transition: all ${({ theme }) => theme.transitions.fast};
    &:hover {
      background: ${({ theme }) => theme.colors.danger}18;
      color: ${({ theme }) => theme.colors.danger};
    }
  `,

  ListDivider: styled.div`
    height: 1px;
    background: ${({ theme }) => theme.colors.border};
    margin: 4px 0;
  `,

  EmptyTags: styled.p`
    font-size: ${({ theme }) => theme.fontSizes.sm};
    color: ${({ theme }) => theme.colors.textMuted};
    text-align: center;
    padding: ${({ theme }) => theme.spacing.lg} 0;
  `,

  PreviewPill: styled.span<{ $color: string }>`
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 3px 9px;
    border-radius: 10px;
    font-size: 12px;
    font-weight: 500;
    background: ${({ $color }) => `${$color}20`};
    color: ${({ $color }) => $color};
    border: 1px solid ${({ $color }) => `${$color}40`};
  `,
};
