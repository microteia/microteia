import type { IPortalRepository } from '../../repositories/IPortalRepository';
import type { PortalHomeSettings } from '../../schema/portalExtensionPoints';
import type { PortalContext, PortalDocument, PortalLinkOption, PortalMembership } from '../../entities/Portal';

export type ListPortalMembershipsUseCase = {
  execute: (userId: string) => Promise<PortalMembership[]>;
};

export const makeListPortalMembershipsUseCase = (repo: IPortalRepository): ListPortalMembershipsUseCase => ({
  execute: (userId) => repo.listMemberships(userId),
});

export type GetPortalContextUseCase = {
  execute: (tenantId: string, locale: string) => Promise<PortalContext>;
};

export const makeGetPortalContextUseCase = (repo: IPortalRepository): GetPortalContextUseCase => ({
  execute: (tenantId, locale) => repo.getContext(tenantId, locale),
});

export type GetPortalDocumentsUseCase = {
  execute: (tenantId: string, projectionId: string) => Promise<PortalDocument[]>;
};

export const makeGetPortalDocumentsUseCase = (repo: IPortalRepository): GetPortalDocumentsUseCase => ({
  execute: (tenantId, projectionId) => repo.getDocuments(tenantId, projectionId),
});

export type GetPortalDocumentUrlUseCase = {
  execute: (tenantId: string, projectionId: string, documentId: string) => Promise<string>;
};

export const makeGetPortalDocumentUrlUseCase = (repo: IPortalRepository): GetPortalDocumentUrlUseCase => ({
  execute: (tenantId, projectionId, documentId) => repo.getDocumentUrl(tenantId, projectionId, documentId),
});

export type InvitePortalGuestUseCase = {
  execute: (tenantId: string, email: string, subjectKey: string, locale: string) => Promise<{ userId: string; created: boolean }>;
};

export const makeInvitePortalGuestUseCase = (repo: IPortalRepository): InvitePortalGuestUseCase => ({
  execute: (tenantId, email, subjectKey, locale) => repo.invite(tenantId, email, subjectKey, locale),
});

export type RevokePortalGuestUseCase = {
  execute: (tenantId: string, userId: string, subjectKey: string | null) => Promise<void>;
};

export const makeRevokePortalGuestUseCase = (repo: IPortalRepository): RevokePortalGuestUseCase => ({
  execute: (tenantId, userId, subjectKey) => repo.revoke(tenantId, userId, subjectKey),
});

export type ListPortalLinkOptionsUseCase = {
  execute: (tenantId: string, userId: string, collection: string) => Promise<PortalLinkOption[]>;
};

export const makeListPortalLinkOptionsUseCase = (repo: IPortalRepository): ListPortalLinkOptionsUseCase => ({
  execute: (tenantId, userId, collection) => repo.listLinkOptions(tenantId, userId, collection),
});

export type SubmitPortalRecordUseCase = {
  execute: (input: {
    tenantId: string;
    collection: string;
    linkRecordId: string;
    data: Record<string, unknown>;
    locale: string;
  }) => Promise<{ id: string }>;
};

export const makeSubmitPortalRecordUseCase = (repo: IPortalRepository): SubmitPortalRecordUseCase => ({
  execute: (input) => repo.submit(input),
});

export type UpdatePortalRecordUseCase = {
  execute: (input: {
    tenantId: string;
    collection: string;
    recordId: string;
    data: Record<string, unknown>;
    locale: string;
  }) => Promise<{ id: string }>;
};

export const makeUpdatePortalRecordUseCase = (repo: IPortalRepository): UpdatePortalRecordUseCase => ({
  execute: (input) => repo.update(input),
});

export type GetPortalHomeSettingsUseCase = { execute: (tenantId: string) => Promise<PortalHomeSettings> };

export const makeGetPortalHomeSettingsUseCase = (repo: IPortalRepository): GetPortalHomeSettingsUseCase => ({
  execute: (tenantId) => repo.getHomeSettings(tenantId),
});

export type SavePortalHomeSettingsUseCase = { execute: (tenantId: string, settings: PortalHomeSettings) => Promise<void> };

export const makeSavePortalHomeSettingsUseCase = (repo: IPortalRepository): SavePortalHomeSettingsUseCase => ({
  execute: (tenantId, settings) => repo.saveHomeSettings(tenantId, settings),
});

export type UploadPortalDocumentUseCase = {
  execute: (input: { tenantId: string; userId: string; collection: string; recordId: string; file: File; type: string }) => Promise<{ id: string }>;
};

export const makeUploadPortalDocumentUseCase = (repo: IPortalRepository): UploadPortalDocumentUseCase => ({
  execute: (input) => repo.uploadDocument(input),
});
