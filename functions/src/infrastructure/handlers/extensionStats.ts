import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { getDI } from '../di/container';
import { countsAsCatalogInstall } from '../../domain/services/extensionStats';

const REGION = 'southamerica-east1';

/**
 * Toda escrita na cópia instalada reconta — não só criar e apagar. É o que deixa a contagem se
 * corrigir sozinha: ligar, desligar ou atualizar uma extensão também conferem o marcador do
 * escritório, e a recontagem é idempotente.
 */
export const countExtensionInstalls = onDocumentWritten(
  { document: 'tenants/{tenantId}/installed_extensions/{extensionId}', region: REGION },
  async (event) => {
    const after = event.data?.after;
    const installed = Boolean(after?.exists) && countsAsCatalogInstall(after?.data());
    await getDI().getRecountExtensionInstallsUseCase().execute({
      pluginId: event.params.extensionId,
      tenantId: event.params.tenantId,
      installed,
    });
  },
);

/** Um voto gravado, trocado ou retirado: a média é recalculada do zero, pelo agregado do servidor. */
export const aggregateExtensionRatings = onDocumentWritten(
  { document: 'extension_stats/{extensionId}/ratings/{userId}', region: REGION },
  async (event) => {
    await getDI().getRecountExtensionRatingsUseCase().execute(event.params.extensionId);
  },
);
