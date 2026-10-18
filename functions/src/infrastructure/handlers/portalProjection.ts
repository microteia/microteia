import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { getDI } from '../di/container';
import { RESERVED_COLLECTIONS } from '../../domain/schema/screenEntity';

const REGION = 'southamerica-east1';

const asStrings = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];

/**
 * Mantém a projeção do portal em dia quando um registro muda.
 *
 * Gatilho próprio, como o dos agregados: uma falha aqui não pode derrubar a auditoria nem a
 * publicação de eventos. Coleção reservada sai antes de qualquer leitura — inclusive a própria
 * `portalRecords`, cuja gravação acorda este mesmo gatilho.
 */
export const projectPortalRecord = onDocumentWritten(
  { document: 'tenants/{tenantId}/{collection}/{docId}', region: REGION },
  async (event) => {
    const { tenantId, collection, docId } = event.params;
    if (RESERVED_COLLECTIONS.has(collection)) return;
    try {
      const after = event.data?.after;
      const data = after?.exists ? (after.data() as Record<string, unknown>) : null;
      await getDI().getProjectPortalRecordUseCase().execute({ tenantId, collection, recordId: docId, data });
    } catch (error) {
      console.error(`[portal] Falha ao projetar ${tenantId}/${collection}/${docId}:`, error);
    }
  },
);

/** O documento compartilhado — e o que deixou de ser — no registro do portal. */
export const projectPortalDocument = onDocumentWritten(
  { document: 'tenants/{tenantId}/{collection}/{recordId}/documents/{documentId}', region: REGION },
  async (event) => {
    const { tenantId, collection, recordId, documentId } = event.params;
    if (RESERVED_COLLECTIONS.has(collection)) return;
    try {
      const after = event.data?.after;
      const data = after?.exists ? (after.data() as Record<string, unknown>) : null;
      await getDI().getProjectPortalDocumentUseCase().execute({ tenantId, collection, recordId, documentId, data });
    } catch (error) {
      console.error(`[portal] Falha ao projetar o documento ${tenantId}/${collection}/${recordId}/${documentId}:`, error);
    }
  },
);

/**
 * O convite mudou: refaz QUEM vê, só nas projeções dos sujeitos que entraram ou saíram dele.
 */
export const refreshPortalAudience = onDocumentWritten(
  { document: 'tenants/{tenantId}/portalUsers/{userId}', region: REGION, timeoutSeconds: 540 },
  async (event) => {
    const { tenantId } = event.params;
    const before = new Set(asStrings(event.data?.before?.get('subjectKeys')));
    const after = new Set(asStrings(event.data?.after?.get('subjectKeys')));
    const changed = [...before, ...after].filter((key) => before.has(key) !== after.has(key));
    if (changed.length === 0) return;
    await getDI().getRefreshPortalAudienceUseCase().execute(tenantId, changed);
  },
);

/** O que, numa tela, decide o que o portal projeta dela. */
const portalShape = (data: Record<string, unknown> | undefined): string =>
  data
    ? JSON.stringify([data.portal ?? null, data.dataCollection ?? null, data.titleFieldKey ?? null,
      data.parentEntity ?? null, data.parentFieldKey ?? null])
    : '';

/**
 * A declaração de portal de uma tela mudou. Refaz TODAS as coleções do portal do escritório, e não
 * só a desta tela: o sujeito de uma tela chega pelas outras, e tirar a tela-sujeito do portal tem de
 * levar junto o que só chegava a alguém por ela. Mudar declaração é raro; deixar uma projeção para
 * trás seria entregar a alguém o que já não é dele.
 */
export const reprojectPortalOnScreenChange = onDocumentWritten(
  { document: 'tenants/{tenantId}/screenDefinitions/{screenId}', region: REGION, timeoutSeconds: 540, memory: '512MiB' },
  async (event) => {
    const { tenantId, screenId } = event.params;
    const before = event.data?.before?.exists ? (event.data.before.data() as Record<string, unknown>) : undefined;
    const after = event.data?.after?.exists ? (event.data.after.data() as Record<string, unknown>) : undefined;
    if (portalShape(before) === portalShape(after)) return;
    if (!before?.portal && !after?.portal) return;

    const collectionOf = (data: Record<string, unknown> | undefined) =>
      typeof data?.dataCollection === 'string' && data.dataCollection ? data.dataCollection : screenId;

    const di = getDI();
    const screens = await di.getPortalRepository().getScreens(tenantId, { fresh: true });
    const collections = new Set<string>([
      collectionOf(before),
      collectionOf(after),
      ...screens.filter((screen) => !!screen.portal).map((screen) => screen.collection),
    ]);
    for (const collection of collections) {
      await di.getReprojectPortalCollectionUseCase().execute(tenantId, collection);
    }
  },
);
