import React from 'react';
import { S } from './FunctionMenu.styles';
import type { AutocompleteItem } from '../../autocompleteHelpers';

export interface FunctionMenuProps {
  active: boolean;
  items: AutocompleteItem[];
  highlightedIndex: number;
  position: { top: number; left: number } | null;
  onSelect: (item: AutocompleteItem) => void;
  onHover: (index: number) => void;
}

export const FunctionMenu: React.FC<FunctionMenuProps> = ({
  active,
  items,
  highlightedIndex,
  position,
  onSelect,
  onHover,
}) => {
  if (!active || !position || items.length === 0) return null;

  return (
    <S.Container $top={position.top} $left={position.left}>
      {items.map((item, i) => (
        <S.Item
          key={`${item.category ?? 'default'}-${item.value}`}
          $highlighted={i === highlightedIndex}
          onClick={() => onSelect(item)}
          onMouseEnter={() => onHover(i)}
        >
          <S.Header>
            <S.FunctionName>{item.label}</S.FunctionName>
            {item.category && <S.Category>{item.category}</S.Category>}
          </S.Header>
          {item.detail && <S.Detail>{item.detail}</S.Detail>}
          {item.description && <S.Description>{item.description}</S.Description>}
        </S.Item>
      ))}
    </S.Container>
  );
};
