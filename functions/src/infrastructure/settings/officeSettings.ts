import { getDI } from '../di/container';
import { resolveSetting } from '../../domain/schema/settings';
import type { SettingsProperty } from '../../domain/schema/settings';

/**
 * Pelo mesmo motivo do fuso (`tenantTimeZone`): o orçamento de tempo e a lista de domínios são lidos a
 * cada execução, e mudam uma vez na vida do escritório. Uma alteração leva até isto para chegar às
 * automações — inclusive tirar um domínio da lista.
 */
const CACHE_TTL_MS = 60_000;

const cache = new Map<string, { values: Record<string, unknown>; expiresAt: number }>();

const officeValues = async (tenantId: string): Promise<Record<string, unknown>> => {
  const cached = cache.get(tenantId);
  if (cached && cached.expiresAt > Date.now()) return cached.values;
  const values = await getDI().getTenantSettingsRepository().getTenantValues(tenantId);
  cache.set(tenantId, { values, expiresAt: Date.now() + CACHE_TTL_MS });
  return values;
};

/**
 * Uma configuração do ESCRITÓRIO, resolvida pela mesma função da tela — o valor inválido cai no padrão
 * declarado, como lá. Sem escopo de pessoa: estas valem para a automação, não para quem a disparou.
 */
export const officeSetting = async (tenantId: string, property: SettingsProperty): Promise<unknown> =>
  resolveSetting(property, { tenant: await officeValues(tenantId), user: {} }).value;
