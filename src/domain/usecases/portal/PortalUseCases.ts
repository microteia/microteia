import type { IPortalRepository } from '../../repositories/IPortalRepository';
import type { PortalHomeSettings } from '../../schema/portalExtensionPoints';
import { PORTAL_TEXT_MAX_LENGTH, portalTextDocId, type PortalTextOverride } from '../../schema/portalText';
import { isValidLocale, normalizeLocale } from '../../schema/i18n/localeNegotiation';
import { LocalizedError } from '../../errors/LocalizedError';
import type { DeletionActor } from '../../entities';
import type { PortalRequiredClaim } from '../../schema/portalIdentity';
import { PORTAL_CREATE_TARGETS_MAX } from '../../schema/portal';
import type {
  PortalActionOutcome,
  PortalContext,
  PortalDocument,
  PortalLinkOption,
  PortalMembership,
  PortalRecordAction,
} from '../../entities/Portal';

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

export type RecordPortalViewUseCase = {
  execute: (tenantId: string, projectionId: string) => Promise<void>;
};

export const makeRecordPortalViewUseCase = (repo: IPortalRepository): RecordPortalViewUseCase => ({
  execute: (tenantId, projectionId) => repo.recordView(tenantId, projectionId),
});

export type ListPortalRecordActionsUseCase = {
  execute: (tenantId: string, projectionId: string, locale: string) => Promise<PortalRecordAction[]>;
};

export const makeListPortalRecordActionsUseCase = (repo: IPortalRepository): ListPortalRecordActionsUseCase => ({
  execute: (tenantId, projectionId, locale) => repo.listRecordActions(tenantId, projectionId, locale),
});

export type RunPortalRecordActionUseCase = {
  execute: (tenantId: string, projectionId: string, actionId: string, locale: string) => Promise<PortalActionOutcome>;
};

export const makeRunPortalRecordActionUseCase = (repo: IPortalRepository): RunPortalRecordActionUseCase => ({
  execute: (tenantId, projectionId, actionId, locale) => repo.runRecordAction(tenantId, projectionId, actionId, locale),
});

export type InvitePortalGuestUseCase = {
  execute: (
    tenantId: string,
    email: string,
    subjectKey: string,
    locale: string,
    requiredClaim?: PortalRequiredClaim,
    role?: string,
  ) => Promise<{ userId: string; created: boolean; inviteId?: string }>;
};

export const makeInvitePortalGuestUseCase = (repo: IPortalRepository): InvitePortalGuestUseCase => ({
  execute: (tenantId, email, subjectKey, locale, requiredClaim, role) => repo.invite(tenantId, email, subjectKey, locale, requiredClaim, role),
});

export type RevokePortalGuestUseCase = {
  execute: (tenantId: string, guest: { userId: string } | { inviteId: string }, subjectKey: string | null) => Promise<void>;
};

export const makeRevokePortalGuestUseCase = (repo: IPortalRepository): RevokePortalGuestUseCase => ({
  execute: (tenantId, guest, subjectKey) => repo.revoke(tenantId, guest, subjectKey),
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

export type ListPortalCreateTargetsUseCase = {
  execute: (input: { tenantId: string; collection: string; linkRecordIds: string[] }) => Promise<string[]>;
};

/** Os pais em que o convidado cria agora — perguntados em lotes, que é o que o servidor aceita de uma vez. */
export const makeListPortalCreateTargetsUseCase = (repo: IPortalRepository): ListPortalCreateTargetsUseCase => ({
  execute: async ({ tenantId, collection, linkRecordIds }) => {
    const batches: string[][] = [];
    for (let index = 0; index < linkRecordIds.length; index += PORTAL_CREATE_TARGETS_MAX) {
      batches.push(linkRecordIds.slice(index, index + PORTAL_CREATE_TARGETS_MAX));
    }
    const open = await Promise.all(batches.map((batch) => repo.listCreateTargets({ tenantId, collection, linkRecordIds: batch })));
    return open.flat();
  },
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

export type ListPortalTextsUseCase = { execute: (tenantId: string) => Promise<PortalTextOverride[]> };

export const makeListPortalTextsUseCase = (repo: IPortalRepository): ListPortalTextsUseCase => ({
  execute: (tenantId) => repo.listPortalTexts(tenantId),
});

export type SavePortalTextUseCase = {
  execute: (tenantId: string, input: { ref: string; locale: string; text: string; actor: DeletionActor }) => Promise<void>;
};

/**
 * Grava o texto do escritório para uma referência num idioma. O texto vazio não é edição — é voltar ao do
 * pacote, que tem gesto próprio —, e o que passa do teto não cabe no log de Auditoria.
 */
export const makeSavePortalTextUseCase = (repo: IPortalRepository): SavePortalTextUseCase => ({
  execute: async (tenantId, input) => {
    if (!portalTextDocId(input.ref) || !isValidLocale(input.locale)) throw new LocalizedError('@core.tenant/portal.texts.invalid');
    if (input.text.trim() === '') throw new LocalizedError('@core.tenant/portal.texts.empty');
    if (input.text.length > PORTAL_TEXT_MAX_LENGTH) {
      throw new LocalizedError('@core.tenant/portal.texts.too-long', { max: String(PORTAL_TEXT_MAX_LENGTH) });
    }
    await repo.savePortalText(tenantId, { ...input, locale: normalizeLocale(input.locale) });
  },
});

export type RestorePortalTextUseCase = {
  execute: (tenantId: string, input: { ref: string; locale: string; actor: DeletionActor }) => Promise<void>;
};

export const makeRestorePortalTextUseCase = (repo: IPortalRepository): RestorePortalTextUseCase => ({
  execute: (tenantId, input) => repo.restorePortalText(tenantId, { ...input, locale: normalizeLocale(input.locale) }),
});

export type UploadPortalDocumentUseCase = {
  execute: (input: { tenantId: string; userId: string; collection: string; recordId: string; file: File; type: string }) => Promise<{ id: string }>;
};

export const makeUploadPortalDocumentUseCase = (repo: IPortalRepository): UploadPortalDocumentUseCase => ({
  execute: (input) => repo.uploadDocument(input),
});
