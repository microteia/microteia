import styled from 'styled-components';

export const S = {
  Palette: styled.div`
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  `,

  Swatch: styled.button<{ $color: string; $selected: boolean }>`
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: ${({ $color }) => $color};
    border: 3px solid ${({ $selected, theme }) =>
      $selected ? theme.colors.text : 'transparent'};
    outline: 2px solid ${({ $selected, $color }) => ($selected ? $color : 'transparent')};
    outline-offset: 1px;
    transition: transform 150ms ease, outline 150ms ease;
    cursor: pointer;
    &:hover { transform: scale(1.15); }
  `,
};
