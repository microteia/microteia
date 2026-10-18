import type { DocumentTemplate } from '../../schema/document/documentTemplate';
import type {
  DocumentTemplateInput,
  GenerateDocumentInput,
  GenerateDocumentResult,
  IDocumentTemplateRepository,
  PreviewDocumentInput,
  PreviewDocumentResult,
} from '../../repositories/IDocumentTemplateRepository';

export type GetDocumentTemplatesUseCase = {
  execute: (tenantId: string) => Promise<DocumentTemplate[]>;
};

export const makeGetDocumentTemplatesUseCase = (repo: IDocumentTemplateRepository): GetDocumentTemplatesUseCase => ({
  execute: (tenantId) => repo.getAll(tenantId),
});

export type SubscribeToDocumentTemplatesUseCase = {
  execute: (tenantId: string, onUpdate: (templates: DocumentTemplate[]) => void) => () => void;
};

export const makeSubscribeToDocumentTemplatesUseCase = (
  repo: IDocumentTemplateRepository,
): SubscribeToDocumentTemplatesUseCase => ({
  execute: (tenantId, onUpdate) => repo.subscribe(tenantId, onUpdate),
});

export type SaveDocumentTemplateUseCase = {
  execute: (tenantId: string, input: DocumentTemplateInput, updatedBy: string | null) => Promise<void>;
};

export const makeSaveDocumentTemplateUseCase = (repo: IDocumentTemplateRepository): SaveDocumentTemplateUseCase => ({
  execute: (tenantId, input, updatedBy) => repo.save(tenantId, input, updatedBy),
});

export type DeleteDocumentTemplateUseCase = {
  execute: (tenantId: string, key: string) => Promise<void>;
};

export const makeDeleteDocumentTemplateUseCase = (repo: IDocumentTemplateRepository): DeleteDocumentTemplateUseCase => ({
  execute: (tenantId, key) => repo.delete(tenantId, key),
});

export type GenerateDocumentUseCase = {
  execute: (input: GenerateDocumentInput) => Promise<GenerateDocumentResult>;
};

export const makeGenerateDocumentUseCase = (repo: IDocumentTemplateRepository): GenerateDocumentUseCase => ({
  execute: (input) => repo.generate(input),
});

export type PreviewDocumentUseCase = {
  execute: (input: PreviewDocumentInput) => Promise<PreviewDocumentResult>;
};

export const makePreviewDocumentUseCase = (repo: IDocumentTemplateRepository): PreviewDocumentUseCase => ({
  execute: (input) => repo.preview(input),
});
