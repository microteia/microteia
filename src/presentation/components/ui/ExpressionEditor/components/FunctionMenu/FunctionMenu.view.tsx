import React from 'react';
import { S } from './FunctionMenu.styles';
import type { ExpressionFunction } from '../../ExpressionEditor.viewmodel';

export interface FunctionMenuProps {
  active: boolean;
  functions: ExpressionFunction[];
  highlightedIndex: number;
  position: { top: number; left: number } | null;
  onSelect: (fn: ExpressionFunction) => void;
  onHover: (index: number) => void;
}

export const FunctionMenu: React.FC<FunctionMenuProps> = ({
  active,
  functions,
  highlightedIndex,
  position,
  onSelect,
  onHover,
}) => {
  if (!active || !position || functions.length === 0) return null;

  return (
    <S.Container $top={position.top} $left={position.left}>
      {functions.map((fn, i) => (
        <S.Item
          key={fn.name}
          $highlighted={i === highlightedIndex}
          onClick={() => onSelect(fn)}
          onMouseEnter={() => onHover(i)}
        >
          <S.FunctionName>{fn.label}</S.FunctionName>
          <S.Description>{fn.description}</S.Description>
        </S.Item>
      ))}
    </S.Container>
  );
};
