import { useMemo } from 'react';
import { useTenant } from '../../../stores/useTenant';
import { useAuth } from '../../../stores/useAuth';
import type { DeletionActor } from '../../../domain/entities';
import type { EntityNote, NotesPort } from './types';

export interface NoteRepositoryLike {
  getNotes(tenantId: string, recordId: string): Promise<EntityNote[]>;
  addNote(
    tenantId: string,
    recordId: string,
    data: { title: string; text: string; createdBy: string; createdByName: string; createdByPhotoUrl?: string },
  ): Promise<EntityNote>;
  deleteNote(tenantId: string, recordId: string, noteId: string, actor: DeletionActor): Promise<void>;
}

export const useNotesPort = (repository: NoteRepositoryLike, extra?: Record<string, unknown>): NotesPort => {
  const { currentTenant } = useTenant();
  const { user, effectiveName } = useAuth();
  return useMemo<NotesPort>(() => ({
    get: (rid) => (currentTenant ? repository.getNotes(currentTenant.id, rid) : Promise.resolve([])),
    add: (rid, input) => repository.addNote(currentTenant?.id ?? '', rid, {
      ...extra,
      title: input.title,
      text: input.text,
      createdBy: user?.id ?? '',
      createdByName: effectiveName,
      createdByPhotoUrl: user?.photoURL ?? undefined,
    }),
    remove: (rid, noteId) => {
      const actor: DeletionActor = { uid: user?.id ?? '', name: effectiveName, photoURL: user?.photoURL ?? '' };
      return repository.deleteNote(currentTenant?.id ?? '', rid, noteId, actor);
    },
  }), [repository, currentTenant, user, effectiveName, extra]);
};
