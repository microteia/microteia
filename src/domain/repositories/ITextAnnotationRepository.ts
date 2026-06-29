import type { AnnotationRange, AnnotationContentType, TextAnnotation } from '../entities';

export interface ITextAnnotationRepository {
  get(
    userId: string,
    contentType: AnnotationContentType,
    contentId: string,
    fieldName: string,
  ): Promise<TextAnnotation | null>;

  save(params: {
    userId: string;
    contentType: AnnotationContentType;
    contentId: string;
    fieldName: string;
    ranges: AnnotationRange[];
  }): Promise<void>;
}
