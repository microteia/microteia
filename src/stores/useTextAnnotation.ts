import { createContext, useContext } from 'react';
import type { AnnotationRange, AnnotationContentType } from '../domain/entities';

export interface TextAnnotationContextType {
  getAnnotations: (
    contentType: AnnotationContentType,
    contentId: string,
    fieldName: string,
  ) => AnnotationRange[];
  isLoading: (
    contentType: AnnotationContentType,
    contentId: string,
    fieldName: string,
  ) => boolean;
  loadAnnotations: (
    contentType: AnnotationContentType,
    contentId: string,
    fieldName: string,
  ) => Promise<void>;
  saveAnnotations: (
    contentType: AnnotationContentType,
    contentId: string,
    fieldName: string,
    ranges: AnnotationRange[],
  ) => Promise<void>;
}

export const TextAnnotationContext = createContext<TextAnnotationContextType | null>(null);

export const useTextAnnotation = (): TextAnnotationContextType => {
  const ctx = useContext(TextAnnotationContext);
  if (!ctx) throw new Error('useTextAnnotation must be used within TextAnnotationStoreProvider');
  return ctx;
};
