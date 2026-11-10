import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { getDI } from '../di/container';
import { declaredScreenSeeds } from '../../domain/schema/screenSeed';
import { runScreenSeedPass } from '../../domain/services/screenSeeds';

const REGION = 'southamerica-east1';

/** O mesmo corte de `runAggregateBackfill`: uma falha determinística não vira custo por dias. */
const MAX_EVENT_AGE_MS = 15 * 60_000;

/**
 * A porta da semeadura é a CÓPIA INSTALADA, e não o gesto de instalar: o catálogo embutido, o registro
 * público, o arquivo avulso e a volta a uma versão do histórico gravam todos este documento, e é aqui
 * que o pacote que o escritório tem de fato é lido — nunca o que um cliente afirmasse ter.
 *
 * Instalar, atualizar e religar disparam a passada; as outras gravações da cópia (revisão de código,
 * carimbo do backend) custam uma leitura do histórico e saem. Desinstalar não faz nada: os registros
 * semeados são do escritório, e o histórico fica para que reinstalar não duplique o catálogo.
 */
export const seedExtensionRecords = onDocumentWritten(
  {
    document: 'tenants/{tenantId}/installed_extensions/{pluginId}',
    region: REGION,
    retry: true,
    timeoutSeconds: 300,
  },
  async (event) => {
    const after = event.data?.after;
    if (!after?.exists) return;
    if (Date.now() - new Date(event.time).getTime() > MAX_EVENT_AGE_MS) return;
    // Sem semente no pacote, nenhuma leitura: é o caso de quase toda extensão.
    if (declaredScreenSeeds(after.data()?.package).length === 0) return;

    const { tenantId, pluginId } = event.params;
    await runScreenSeedPass(tenantId, pluginId, getDI().getScreenSeedDeps());
  },
);
