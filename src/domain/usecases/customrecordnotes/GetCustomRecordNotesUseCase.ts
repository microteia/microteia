import type { ICustomRecordNoteRepository } from '../../repositories/ICustomRecordNoteRepository';
import type { CustomRecordNote } from '../../entities';

export type GetCustomRecordNotesUseCase = {
  execute: (tenantId: string, recordId: string) => Promise<CustomRecordNote[]>;
};

export const makeGetCustomRecordNotesUseCase = (repo: ICustomRecordNoteRepository): GetCustomRecordNotesUseCase => ({
  execute: (tenantId, recordId) => repo.getNotes(tenantId, recordId),
});
