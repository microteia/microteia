import type { IContractDocumentRepository } from '../../repositories/IContractDocumentRepository';
import type { ContractDocument } from '../../entities';

export type AddContractDocumentUseCase = {
  execute: (tenantId: string, contractId: string, data: Omit<ContractDocument, 'id' | 'contractId' | 'tenantId' | 'createdAt'>) => Promise<ContractDocument>;
};

export const makeAddContractDocumentUseCase = (repo: IContractDocumentRepository): AddContractDocumentUseCase => ({
  execute: (tenantId, contractId, data) => repo.addDocument(tenantId, contractId, data),
});
