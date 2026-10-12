import { resolveTimeZone } from '../../domain/schema/i18n/timeZone';
import { getDI } from '../di/container';

/**
 * Quanto tempo um fuso resolvido vale sem reler as configurações. Uma automação disparada por
 * gravação roda a cada registro salvo; reler dois documentos por execução só para descobrir algo que
 * muda uma vez na vida do escritório seria custo sem retorno. Trocar o fuso leva até isto para
 * chegar às automações.
 */
const CACHE_TTL_MS = 60_000;

const cache = new Map<string, { timeZone: string; expiresAt: number }>();

/**
 * O fuso do escritório no SERVIDOR: `user > tenant > padrão`, pela MESMA função que o cliente usa
 * (`resolveTimeZone`). É isso que faz `today()` responder o mesmo dia na tela e na automação.
 *
 * Sem pessoa (automação disparada por gatilho), vale o do escritório.
 */
export const tenantTimeZone = async (tenantId: string, userId?: string): Promise<string> => {
  const key = `${tenantId}:${userId ?? ''}`;
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.timeZone;

  const settings = getDI().getTenantSettingsRepository();
  const [user, tenant] = await Promise.all([
    userId ? settings.getUserValues(tenantId, userId) : Promise.resolve({}),
    settings.getTenantValues(tenantId),
  ]);
  const timeZone = resolveTimeZone({ user, tenant });
  cache.set(key, { timeZone, expiresAt: Date.now() + CACHE_TTL_MS });
  return timeZone;
};
