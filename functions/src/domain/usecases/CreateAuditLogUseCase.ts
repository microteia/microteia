import type { AuditAction, AuditSeverity, AuditType } from '../entities/AuditLog';
import type { IAuditLogRepository } from '../repositories/IAuditLogRepository';

export interface CreateAuditLogInput {
  tenantId: string;
  /** REFERÊNCIA de mensagem; os `*Params` trazem o que a frase interpola. */
  title: string;
  titleParams?: Record<string, string>;
  userId: string;
  userName: string;
  photoURL: string;
  action: AuditAction;
  severity?: AuditSeverity;
  type?: AuditType;
  entity: string;
  entityId: string;
  entityLink?: string;
  linkCollection?: string;
  linkRecordId?: string;
  text: string;
  textParams?: Record<string, string>;
}

export type CreateAuditLogUseCase = {
  execute: (input: CreateAuditLogInput) => Promise<void>;
};

export const makeCreateAuditLogUseCase = (repo: IAuditLogRepository): CreateAuditLogUseCase => ({
  execute: (input) => repo.create({
    tenantId: input.tenantId,
    title: input.title,
    userId: input.userId,
    userName: input.userName,
    photoURL: input.photoURL,
    action: input.action,
    severity: input.severity ?? 'LOW',
    type: input.type ?? 'AUDIT',
    entity: input.entity,
    entityId: input.entityId,
    entityLink: input.entityLink,
    linkCollection: input.linkCollection,
    linkRecordId: input.linkRecordId,
    text: input.text,
  }),
});
