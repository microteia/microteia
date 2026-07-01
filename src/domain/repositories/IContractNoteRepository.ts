import type { ContractNote } from '../entities';

export interface IContractNoteRepository {
  getNotes(tenantId: string, contractId: string): Promise<ContractNote[]>;
  addNote(tenantId: string, contractId: string, data: Omit<ContractNote, 'id' | 'contractId' | 'tenantId' | 'createdAt'>): Promise<ContractNote>;
  deleteNote(tenantId: string, contractId: string, noteId: string): Promise<void>;
}
