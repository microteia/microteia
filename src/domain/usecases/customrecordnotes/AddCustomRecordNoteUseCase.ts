import type { ICustomRecordNoteRepository } from '../../repositories/ICustomRecordNoteRepository';
import type { CustomRecordNote } from '../../entities';

export type AddCustomRecordNoteUseCase = {
  execute: (tenantId: string, recordId: string, data: Omit<CustomRecordNote, 'id' | 'recordId' | 'tenantId' | 'createdAt'>) => Promise<CustomRecordNote>;
};

export const makeAddCustomRecordNoteUseCase = (repo: ICustomRecordNoteRepository): AddCustomRecordNoteUseCase => ({
  execute: (tenantId, recordId, data) => repo.addNote(tenantId, recordId, data),
});
