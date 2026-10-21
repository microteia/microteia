import { useMemo } from 'react';
import { useTenant } from '../../../stores/useTenant';
import { useAuth } from '../../../stores/useAuth';
import type { DeletionActor } from '../../../domain/entities';
import type { EntityDocument, DocumentsPort } from './types';

export interface DocumentRepositoryLike {
  getDocuments(tenantId: string, recordId: string): Promise<EntityDocument[]>;
  uploadDocument(tenantId: string, recordId: string, file: File): Promise<string>;
  addDocument(
    tenantId: string,
    recordId: string,
    data: { name: string; type?: string; url: string; storagePath: string; createdBy: string; createdByName: string; createdByPhotoUrl?: string },
  ): Promise<EntityDocument>;
  deleteDocument(tenantId: string, recordId: string, documentId: string, storagePath: string, actor: DeletionActor): Promise<void>;
  setPortalShared?(tenantId: string, recordId: string, documentId: string, shared: boolean, actorUid: string): Promise<void>;
}

export const useDocumentsPort = (repository: DocumentRepositoryLike, extra?: Record<string, unknown>): DocumentsPort => {
  const { currentTenant } = useTenant();
  const { user, effectiveName } = useAuth();
  return useMemo<DocumentsPort>(() => {
    const setShared = repository.setPortalShared?.bind(repository);
    return {
      get: (rid) => (currentTenant ? repository.getDocuments(currentTenant.id, rid) : Promise.resolve([])),
      upload: async (rid, file) => {
        const raw = await repository.uploadDocument(currentTenant?.id ?? '', rid, file);
        return JSON.parse(raw) as { url: string; storagePath: string };
      },
      add: (rid, input) => repository.addDocument(currentTenant?.id ?? '', rid, {
        ...extra,
        name: input.name,
        type: input.type,
        url: input.url,
        storagePath: input.storagePath,
        createdBy: user?.id ?? '',
        createdByName: effectiveName,
        createdByPhotoUrl: user?.photoURL ?? undefined,
      }),
      remove: (rid, doc) => {
        const actor: DeletionActor = { uid: user?.id ?? '', name: effectiveName, photoURL: user?.photoURL ?? '' };
        return repository.deleteDocument(currentTenant?.id ?? '', rid, doc.id, doc.storagePath, actor);
      },
      ...(setShared
        ? {
          setPortalShared: (rid: string, doc: EntityDocument, shared: boolean) =>
            setShared(currentTenant?.id ?? '', rid, doc.id, shared, user?.id ?? ''),
        }
        : {}),
    };
  }, [repository, currentTenant, user, effectiveName, extra]);
};
