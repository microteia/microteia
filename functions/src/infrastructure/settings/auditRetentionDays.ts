import { DEFAULT_AUDIT_RETENTION_DAYS } from '../../domain/schema/auditRetention';
import type { IAuditRetentionRepository } from '../../domain/repositories/IAuditRetentionRepository';

/**
 * Quanto tempo a retenção lida vale sem reler. Cada gravação de registro gera uma linha de auditoria;
 * reler a política a cada uma seria uma leitura a mais por gravação para descobrir algo que muda
 * quase nunca. Mudar a retenção leva até isto para chegar às linhas novas.
 */
const CACHE_TTL_MS = 5 * 60_000;

/** O escritório-fantasma dos erros globais do pipeline: não tem política, e não vale a leitura. */
const SYSTEM_TENANT = 'SYSTEM';

/**
 * A retenção de consulta do escritório, para carimbar o `expiresAt` de cada linha. FALHA FECHADA no
 * padrão: uma política ilegível nunca impede a auditoria de acontecer — no pior caso, a linha vence
 * nos 30 dias que sempre valeram.
 */
export const makeAuditRetentionDaysOf = (
  repository: () => IAuditRetentionRepository,
  warn: (message: string, detail?: unknown) => void,
  now: () => number = Date.now,
): ((tenantId: string) => Promise<number>) => {
  const cache = new Map<string, { days: number; expiresAt: number }>();
  return async (tenantId) => {
    if (!tenantId || tenantId === SYSTEM_TENANT) return DEFAULT_AUDIT_RETENTION_DAYS;
    const cached = cache.get(tenantId);
    if (cached && cached.expiresAt > now()) return cached.days;
    try {
      const { policy } = await repository().get(tenantId);
      cache.set(tenantId, { days: policy.retentionDays, expiresAt: now() + CACHE_TTL_MS });
      return policy.retentionDays;
    } catch (error) {
      warn(`[audit] retention of ${tenantId} unreadable; using the default`, error);
      return DEFAULT_AUDIT_RETENTION_DAYS;
    }
  };
};
