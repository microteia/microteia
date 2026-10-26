import { getDI } from '../di/container';
import { declaredEventPrefix, hasRegistryEventPrefix } from '../../domain/services/workflowEventEntities';

/**
 * O prefixo de evento da coleção: o que a TELA declara (`eventPrefix`), quando declara; senão, o da
 * convenção. Falha volta à convenção.
 *
 * A coleção do registro resolve sem leitura; para as demais, o cache de telas já é carregado pelo
 * motor e tem TTL, então a consulta não custa uma leitura por escrita.
 */
export const resolveEventPrefix = async (
  tenantId: string,
  collection: string,
  convention: string,
): Promise<string> => {
  if (hasRegistryEventPrefix(collection) || convention === 'lookup') return convention;
  try {
    const screens = await getDI().getScreenDefinitionCache().getScreens(tenantId);
    return declaredEventPrefix(screens, collection) ?? convention;
  } catch (error) {
    console.error(`[workflow] Falha ao resolver o prefixo de ${tenantId}/${collection}:`, error);
    return convention;
  }
};
