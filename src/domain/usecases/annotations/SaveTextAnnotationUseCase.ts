import type { ITextAnnotationRepository } from '../../repositories/ITextAnnotationRepository';
import type { AnnotationRange, AnnotationContentType } from '../../entities';

export type SaveTextAnnotationUseCase = {
  execute: (params: {
    userId: string;
    contentType: AnnotationContentType;
    contentId: string;
    fieldName: string;
    ranges: AnnotationRange[];
  }) => Promise<void>;
};

export const makeSaveTextAnnotationUseCase = (
  repo: ITextAnnotationRepository,
): SaveTextAnnotationUseCase => ({
  execute: (params) => repo.save(params),
});
