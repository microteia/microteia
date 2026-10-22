import { getDI } from '../di/container';

/** Os escritórios que esta instância já conferiu. A revisão só muda com um deploy, que troca a instância. */
const checked = new Set<string>();

/**
 * Leva ao escritório uma correção na forma de projetar (`PORTAL_PROJECTION_REVISION`): uma conferência
 * por escritório e por instância, e a passada só é aberta onde a revisão gravada ficou para trás. Quem
 * chama não cai com ela, e não espera a passada: só a abertura dela — o portal continua servindo
 * enquanto ela anda.
 */
export const ensurePortalProjectionRevision = async (tenantId: string): Promise<void> => {
  if (checked.has(tenantId)) return;
  checked.add(tenantId);
  try {
    await getDI().getEnsurePortalProjectionRevisionUseCase().execute(tenantId);
  } catch (error) {
    checked.delete(tenantId);
    console.error(`[portal] Falha ao conferir a revisão da projeção de ${tenantId}:`, error);
  }
};
