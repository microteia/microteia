import { doc, getDoc, setDoc, Timestamp } from 'firebase/firestore';
import { db } from '../../infrastructure/firebase/config';
import type { ITextAnnotationRepository } from '../../domain/repositories/ITextAnnotationRepository';
import type { AnnotationRange, AnnotationContentType, TextAnnotation } from '../../domain/entities';

const COL = 'textAnnotations';

const makeDocId = (
  userId: string,
  contentType: AnnotationContentType,
  contentId: string,
  fieldName: string,
): string => `${userId}_${contentType}_${contentId}_${fieldName}`;

export class FirebaseTextAnnotationRepository implements ITextAnnotationRepository {
  async get(
    userId: string,
    contentType: AnnotationContentType,
    contentId: string,
    fieldName: string,
  ): Promise<TextAnnotation | null> {
    const docId = makeDocId(userId, contentType, contentId, fieldName);
    const snap = await getDoc(doc(db, COL, docId));
    if (!snap.exists()) return null;
    const data = snap.data();
    return {
      id: snap.id,
      userId: data['userId'] as string,
      contentType: data['contentType'] as AnnotationContentType,
      contentId: data['contentId'] as string,
      fieldName: data['fieldName'] as string,
      ranges: (data['ranges'] as AnnotationRange[]) ?? [],
      updatedAt: (data['updatedAt'] as Timestamp).toDate(),
    };
  }

  async save(params: {
    userId: string;
    contentType: AnnotationContentType;
    contentId: string;
    fieldName: string;
    ranges: AnnotationRange[];
  }): Promise<void> {
    const docId = makeDocId(params.userId, params.contentType, params.contentId, params.fieldName);
    await setDoc(doc(db, COL, docId), {
      userId: params.userId,
      contentType: params.contentType,
      contentId: params.contentId,
      fieldName: params.fieldName,
      ranges: params.ranges,
      updatedAt: Timestamp.now(),
    });
  }
}
