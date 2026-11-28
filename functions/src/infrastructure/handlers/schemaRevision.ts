import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { FieldValue } from 'firebase-admin/firestore';
import { getDb } from '../firebase/initFirebase';
import { SCHEMA_REVISION_FIELD, schemaRevisionPath } from '../../data/services/schemaRevision';
import { SCREEN_CACHE_TTL_MS } from '../../data/services/ScreenDefinitionCache';

/**
 * Passado o TTL do cache, toda instância já relê a tela por conta própria: refazer o carimbo depois
 * disso não muda nada, e só a entrega dentro dessa janela vale a insistência do `retry`.
 */
const MAX_EVENT_AGE_MS = SCREEN_CACHE_TTL_MS;

/**
 * Sobe o carimbo da declaração a cada gravação de tela (#58). Gatilho próprio, e não um passo dos
 * outros três que escutam `screenDefinitions`: a falha de um recálculo não pode deixar as instâncias
 * presas na tela de antes. O incremento não é idempotente, e não precisa ser — um número a mais custa
 * uma releitura, nunca uma tela velha.
 */
export const stampSchemaRevisionOnScreenChange = onDocumentWritten(
  { document: 'tenants/{tenantId}/screenDefinitions/{screenId}', region: 'southamerica-east1', retry: true },
  async (event) => {
    if (Date.now() - new Date(event.time).getTime() > MAX_EVENT_AGE_MS) return;
    await getDb().doc(schemaRevisionPath(event.params.tenantId)).set(
      { [SCHEMA_REVISION_FIELD]: FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp() },
      { merge: true },
    );
  },
);
