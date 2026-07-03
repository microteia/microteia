import type { ITenantMemberRepository } from '../repositories/ITenantMemberRepository';
import type { IUserProfileLookupService } from '../repositories/IUserProfileLookupService';
import type { CreateAuditLogUseCase } from './CreateAuditLogUseCase';

export interface LogClientErrorInput {
  tenantId: string;
  title: string;
  entity: string;
  entityId?: string;
  entityLink?: string;
  message: string;
  stack?: string;
}

export type LogClientErrorUseCase = {
  execute: (input: LogClientErrorInput, requesterId: string) => Promise<void>;
};

export const makeLogClientErrorUseCase = (
  tenantMemberRepo: ITenantMemberRepository,
  userProfileLookupService: IUserProfileLookupService,
  createAuditLogUseCase: CreateAuditLogUseCase,
): LogClientErrorUseCase => ({
  execute: async (input, requesterId) => {
    const isMember = await tenantMemberRepo.isMember(input.tenantId, requesterId);
    if (!isMember) {
      throw new Error('Usuário não pertence a este escritório.');
    }

    const actor = await userProfileLookupService.resolveActor(requesterId);
    const text = input.stack
      ? `${input.message}\n\n\`\`\`\n${input.stack}\n\`\`\``
      : input.message;

    await createAuditLogUseCase.execute({
      tenantId: input.tenantId,
      title: input.title,
      userId: requesterId,
      userName: actor.name,
      photoURL: actor.photoURL,
      action: 'SYSTEM',
      severity: 'CRITICAL',
      type: 'ERROR',
      entity: input.entity,
      entityId: input.entityId ?? input.entity,
      entityLink: input.entityLink,
      text,
    });
  },
});
