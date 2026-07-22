import type { PluginHost } from '../../kernel';
import { DATA_SERVICE_POINT } from '../../domain/schema/dataExtensionPoints';
import type { ServiceContributionMetadata } from '../../domain/schema/dataExtensionPoints';

/**
 * Resolve um serviço registrado por um plugin via `data.service`. É a única superfície pela qual
 * um plugin injeta comportamento no DI do frontend sem tocar no container tipado do núcleo. Chave
 * ausente devolve `undefined` — o chamador decide se isso é opcional ou erro.
 */
export const resolvePluginService = <T>(host: PluginHost, serviceKey: string): T | undefined => {
  const contribution = host.contributions
    .query(DATA_SERVICE_POINT)
    .find((entry) => (entry.metadata as unknown as ServiceContributionMetadata).serviceKey === serviceKey);

  if (!contribution || contribution.impl?.kind !== 'code') return undefined;
  return host.implementations.resolve<T>(contribution.pluginId, contribution.impl.key);
};
