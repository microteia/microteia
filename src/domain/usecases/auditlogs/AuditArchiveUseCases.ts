import type { IAuditArchiveRepository } from '../../repositories/IAuditArchiveRepository';
import type {
  AuditArchiveDayPage,
  AuditChainLink,
  AuditChainVerification,
  AuditRetentionPolicy,
  AuditRetentionStatus,
} from '../../schema/auditRetention';

export type GetAuditRetentionStatusUseCase = {
  execute: (tenantId: string) => Promise<AuditRetentionStatus>;
};

export const makeGetAuditRetentionStatusUseCase = (repo: IAuditArchiveRepository): GetAuditRetentionStatusUseCase => ({
  execute: (tenantId) => repo.getStatus(tenantId),
});

export type SaveAuditRetentionPolicyUseCase = {
  execute: (tenantId: string, policy: AuditRetentionPolicy) => Promise<AuditRetentionStatus>;
};

export const makeSaveAuditRetentionPolicyUseCase = (repo: IAuditArchiveRepository): SaveAuditRetentionPolicyUseCase => ({
  execute: (tenantId, policy) => repo.savePolicy(tenantId, policy),
});

export type ReadAuditArchiveDayUseCase = {
  execute: (tenantId: string, day: string, offset: number, limit: number) => Promise<AuditArchiveDayPage>;
};

export const makeReadAuditArchiveDayUseCase = (repo: IAuditArchiveRepository): ReadAuditArchiveDayUseCase => ({
  execute: (tenantId, day, offset, limit) => repo.readDay(tenantId, day, offset, limit),
});

export type VerifyAuditArchiveUseCase = {
  /** Continua sozinho enquanto o servidor devolver `partial`: quem pede quer a cadeia inteira. */
  execute: (tenantId: string, onProgress?: (partial: AuditChainVerification) => void) => Promise<AuditChainVerification>;
};

/**
 * Tantas rodadas, no máximo. Cada uma confere minutos de arquivo; um teto impede que um servidor que
 * devolvesse sempre o mesmo ponto prendesse a tela para sempre.
 */
const MAX_VERIFY_ROUNDS = 50;

export const makeVerifyAuditArchiveUseCase = (repo: IAuditArchiveRepository): VerifyAuditArchiveUseCase => ({
  execute: async (tenantId, onProgress) => {
    let resume: AuditChainLink | null = null;
    let daysChecked = 0;
    let firstDay: string | null = null;
    const gaps: AuditChainVerification['gaps'] = [];
    const incompleteDays: string[] = [];
    for (let round = 0; ; round += 1) {
      const result = await repo.verify(tenantId, resume);
      daysChecked += result.daysChecked;
      firstDay ??= result.firstDay;
      gaps.push(...result.gaps);
      incompleteDays.push(...result.incompleteDays);
      const merged: AuditChainVerification = { ...result, daysChecked, firstDay, gaps: [...gaps], incompleteDays: [...incompleteDays] };
      if (result.status !== 'partial' || !result.resume || round + 1 >= MAX_VERIFY_ROUNDS) return merged;
      if (resume && result.resume.day === resume.day) return merged;
      onProgress?.(merged);
      resume = result.resume;
    }
  },
});
