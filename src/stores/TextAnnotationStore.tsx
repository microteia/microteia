import React, { useState, useCallback, useMemo, useRef } from 'react';
import { useDI } from '../infrastructure/di/useDI';
import { useAuth } from './useAuth';
import { makeGetTextAnnotationUseCase } from '../domain/usecases/annotations/GetTextAnnotationUseCase';
import { makeSaveTextAnnotationUseCase } from '../domain/usecases/annotations/SaveTextAnnotationUseCase';
import type { AnnotationRange, AnnotationContentType } from '../domain/entities';
import { TextAnnotationContext } from './useTextAnnotation';

const makeKey = (
  contentType: AnnotationContentType,
  contentId: string,
  fieldName: string,
): string => `${contentType}:${contentId}:${fieldName}`;

export const TextAnnotationStoreProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { textAnnotationRepository } = useDI();
  const { user } = useAuth();

  const uc = useMemo(
    () => ({
      get: makeGetTextAnnotationUseCase(textAnnotationRepository),
      save: makeSaveTextAnnotationUseCase(textAnnotationRepository),
    }),
    [textAnnotationRepository],
  );

  const [cache, setCache] = useState<Record<string, AnnotationRange[]>>({});
  const [loadingKeys, setLoadingKeys] = useState<Set<string>>(new Set());
  const loadedRef = useRef<Set<string>>(new Set());
  const inFlightRef = useRef<Set<string>>(new Set());

  const getAnnotations = useCallback(
    (contentType: AnnotationContentType, contentId: string, fieldName: string): AnnotationRange[] =>
      cache[makeKey(contentType, contentId, fieldName)] ?? [],
    [cache],
  );

  const isLoading = useCallback(
    (contentType: AnnotationContentType, contentId: string, fieldName: string): boolean =>
      loadingKeys.has(makeKey(contentType, contentId, fieldName)),
    [loadingKeys],
  );

  const loadAnnotations = useCallback(
    async (
      contentType: AnnotationContentType,
      contentId: string,
      fieldName: string,
    ): Promise<void> => {
      if (!user) return;
      const key = makeKey(contentType, contentId, fieldName);
      if (loadedRef.current.has(key) || inFlightRef.current.has(key)) return;

      inFlightRef.current.add(key);
      setLoadingKeys((prev) => new Set([...prev, key]));

      try {
        const annotation = await uc.get.execute(user.id, contentType, contentId, fieldName);
        const ranges = annotation?.ranges ?? [];
        setCache((prev) => ({ ...prev, [key]: ranges }));
        loadedRef.current.add(key);
      } finally {
        inFlightRef.current.delete(key);
        setLoadingKeys((prev) => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
      }
    },
    [user, uc],
  );

  const saveAnnotations = useCallback(
    async (
      contentType: AnnotationContentType,
      contentId: string,
      fieldName: string,
      ranges: AnnotationRange[],
    ): Promise<void> => {
      if (!user) return;
      const key = makeKey(contentType, contentId, fieldName);
      setCache((prev) => ({ ...prev, [key]: ranges }));
      await uc.save.execute({ userId: user.id, contentType, contentId, fieldName, ranges });
    },
    [user, uc],
  );

  return (
    <TextAnnotationContext.Provider
      value={{ getAnnotations, isLoading, loadAnnotations, saveAnnotations }}
    >
      {children}
    </TextAnnotationContext.Provider>
  );
};
