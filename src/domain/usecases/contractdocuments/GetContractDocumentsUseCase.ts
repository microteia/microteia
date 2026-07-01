import type { IContractDocumentRepository } from '../../repositories/IContractDocumentRepository';
import type { ContractDocument } from '../../entities';

export type GetContractDocumentsUseCase = {
  execute: (tenantId: string, contractId: string) => Promise<ContractDocument[]>;
};

export const makeGetContractDocumentsUseCase = (repo: IContractDocumentRepository): GetContractDocumentsUseCase => ({
  execute: (tenantId, contractId) => repo.getDocuments(tenantId, contractId),
});
