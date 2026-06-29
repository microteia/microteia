import type { AnnotationFormatType, AnnotationHighlightColor } from '../../../../domain/entities';

export interface TextAnnotationToolbarProps {
  position: { x: number; y: number };
  activeFormats: {
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
    strikethrough?: boolean;
    highlightColor?: AnnotationHighlightColor;
  };
  onFormat: (formatType: AnnotationFormatType) => void;
  onHighlight: (color: AnnotationHighlightColor) => void;
  onRemoveHighlight: () => void;
}

export const HIGHLIGHT_COLORS: AnnotationHighlightColor[] = [
  'yellow',
  'green',
  'pink',
  'blue',
  'orange',
];
