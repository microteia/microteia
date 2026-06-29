import React from 'react';
import type { AnnotationHighlightColor } from '../../../../domain/entities';
import { S } from './TextAnnotationToolbar.styles';
import {
  HIGHLIGHT_COLORS,
  type TextAnnotationToolbarProps,
} from './TextAnnotationToolbar.viewmodel';

export const TextAnnotationToolbar: React.FC<TextAnnotationToolbarProps> = ({
  position,
  activeFormats,
  onFormat,
  onHighlight,
  onRemoveHighlight,
}) => (
  <S.Toolbar $x={position.x} $y={position.y}>
    <S.FormatButton
      $active={activeFormats.bold}
      onMouseDown={(e) => { e.preventDefault(); onFormat('bold'); }}
      title="Negrito"
    >
      B
    </S.FormatButton>

    <S.FormatButton
      $active={activeFormats.italic}
      style={{ fontStyle: 'italic' }}
      onMouseDown={(e) => { e.preventDefault(); onFormat('italic'); }}
      title="Itálico"
    >
      I
    </S.FormatButton>

    <S.FormatButton
      $active={activeFormats.underline}
      style={{ textDecoration: 'underline' }}
      onMouseDown={(e) => { e.preventDefault(); onFormat('underline'); }}
      title="Sublinhado"
    >
      U
    </S.FormatButton>

    <S.FormatButton
      $active={activeFormats.strikethrough}
      style={{ textDecoration: 'line-through' }}
      onMouseDown={(e) => { e.preventDefault(); onFormat('strikethrough'); }}
      title="Riscado"
    >
      S
    </S.FormatButton>

    <S.Divider />

    {HIGHLIGHT_COLORS.map((color: AnnotationHighlightColor) => (
      <S.HighlightButton
        key={color}
        $color={color}
        $active={activeFormats.highlightColor === color}
        onMouseDown={(e) => {
          e.preventDefault();
          if (activeFormats.highlightColor === color) { onRemoveHighlight(); } else { onHighlight(color); }
        }}
        title={`Marcação ${color}`}
      />
    ))}
  </S.Toolbar>
);
