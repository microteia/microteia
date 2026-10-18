import type { IPortalRepository } from '../../repositories/IPortalRepository';
import type { PortalContext, PortalDocument, PortalMembership } from '../../entities/Portal';

export type ListPortalMembershipsUseCase = {
  execute: (userId: string) => Promise<PortalMembership[]>;
};

export const makeListPortalMembershipsUseCase = (repo: IPortalRepository): ListPortalMembershipsUseCase => ({
  execute: (userId) => repo.listMemberships(userId),
});

export type GetPortalContextUseCase = {
  execute: (tenantId: string) => Promise<PortalContext>;
};

export const makeGetPortalContextUseCase = (repo: IPortalRepository): GetPortalContextUseCase => ({
  execute: (tenantId) => repo.getContext(tenantId),
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
