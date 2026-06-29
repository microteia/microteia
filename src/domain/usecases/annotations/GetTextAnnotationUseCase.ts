import type { ITextAnnotationRepository } from '../../repositories/ITextAnnotationRepository';
import type { AnnotationContentType, TextAnnotation } from '../../entities';

export type GetTextAnnotationUseCase = {
  execute: (
    userId: string,
    contentType: AnnotationContentType,
    contentId: string,
    fieldName: string,
  ) => Promise<TextAnnotation | null>;
};

export const makeGetTextAnnotationUseCase = (
  repo: ITextAnnotationRepository,
): GetTextAnnotationUseCase => ({
  execute: (userId, contentType, contentId, fieldName) =>
    repo.get(userId, contentType, contentId, fieldName),
});
