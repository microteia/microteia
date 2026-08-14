import React from 'react';
import type { AnnotationHighlightColor } from '../../../../domain/entities';
import { S } from './TextAnnotationToolbar.styles';
import { useT } from '../../../shared/i18n/useT';
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
}) => {
  const t = useT('core.ui');

  return (
  <S.Toolbar $x={position.x} $y={position.y}>
    <S.FormatButton
      $active={activeFormats.bold}
      onMouseDown={(e) => { e.preventDefault(); onFormat('bold'); }}
      title={t('markdown.bold')}
    >
      B
    </S.FormatButton>

    <S.FormatButton
      $active={activeFormats.italic}
      style={{ fontStyle: 'italic' }}
      onMouseDown={(e) => { e.preventDefault(); onFormat('italic'); }}
      title={t('markdown.italic')}
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
        title={t('annotation.highlight', { color })}
      />
    ))}
  </S.Toolbar>
  );
};
