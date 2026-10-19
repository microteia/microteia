import type { IPortalRepository } from '../../repositories/IPortalRepository';
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
  execute: (tenantId: string, email: string, subjectKey: string) => Promise<{ userId: string; created: boolean }>;
};

export const makeInvitePortalGuestUseCase = (repo: IPortalRepository): InvitePortalGuestUseCase => ({
  execute: (tenantId, email, subjectKey) => repo.invite(tenantId, email, subjectKey),
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
