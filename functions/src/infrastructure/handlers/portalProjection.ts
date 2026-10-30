import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { getDI } from '../di/container';
import { RESERVED_COLLECTIONS } from '../../domain/schema/screenEntity';
import { PORTAL_REPROJECTIONS_COLLECTION } from '../../domain/schema/portal';
import { portalReprojectionScope } from '../../domain/usecases/PortalReprojectionUseCases';
import { ensurePortalProjectionRevision } from '../portal/portalProjectionRevision';

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
    const after = event.data?.after;
    const data = after?.exists ? (after.data() as Record<string, unknown>) : null;
    try {
      const inPortal = await getDI().getProjectPortalRecordUseCase().execute({ tenantId, collection, recordId: docId, data });
      if (inPortal) await ensurePortalProjectionRevision(tenantId);
    } catch (error) {
      console.error(`[portal] Falha ao projetar ${tenantId}/${collection}/${docId}:`, error);
    }
    // A coleção pode estar FORA do portal e ainda assim dar nome a um rótulo dele (`referenceTitles`).
    try {
      const previous = event.data?.before;
      const before = previous?.exists ? (previous.data() as Record<string, unknown>) : null;
      await getDI().getRefreshPortalReferenceLabelsUseCase().execute({ tenantId, collection, recordId: docId, before, after: data });
    } catch (error) {
      console.error(`[portal] Falha ao refazer os rótulos que mostram ${tenantId}/${collection}/${docId}:`, error);
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
      const previous = event.data?.before;
      const before = previous?.exists ? (previous.data() as Record<string, unknown>) : null;
      await getDI().getProjectPortalDocumentUseCase().execute({ tenantId, collection, recordId, documentId, data, before });
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

/**
 * O que, numa tela, decide o que o portal projeta dela. Dos campos, só o que muda o vínculo ou o que
 * existe: trocar o `refEntity` do campo-sujeito, ou apagar um campo exposto, refaz a projeção; mudar
 * um rótulo, não.
 */
const portalShape = (data: Record<string, unknown> | undefined): string => {
  if (!data) return '';
  const fields = Array.isArray(data.fields)
    ? (data.fields as Array<Record<string, unknown>>).map((field) =>
      [field.key ?? null, field.type ?? null, field.refEntity ?? null, field.multi === true])
    : null;
  return JSON.stringify([projectedPortal(data.portal), data.dataCollection ?? null, data.titleFieldKey ?? null,
    data.parentEntity ?? null, data.parentFieldKey ?? null, fields]);
};

/**
 * A declaração sem o que não muda projeção nenhuma: quem pode CONVIDAR (`invites`) decide quem entra,
 * não o que cada um vê; registrar as aberturas (`trackViews`) decide o que fica anotado, não o que sai;
 * as ações (`actions`) são avaliadas a cada pedido, e nada delas é gravado na projeção; o desenho
 * (`template`) só arranja o que a projeção já tem, e chega ao convidado pelo contexto. Ligar qualquer
 * um deles abriria uma passada em toda coleção que chega à tela-sujeito — o custo de plataforma que
 * a fila de reprojeções existe para conter.
 */
const projectedPortal = (portal: unknown): unknown => {
  if (!portal || typeof portal !== 'object' || Array.isArray(portal)) return portal ?? null;
  const rest = { ...(portal as Record<string, unknown>) };
  delete rest.invites;
  delete rest.trackViews;
  delete rest.actions;
  delete rest.template;
  return rest;
};

/**
 * Entrega do gatilho mais velha que isto não é refeita: com `retry`, o Firebase reentrega uma falha
 * por dias, e uma rodada que falha sempre do mesmo jeito viraria custo sem fim. A passada parada é
 * acordada pela próxima mudança de declaração (`nudge`), não pela insistência.
 */
const MAX_EVENT_AGE_MS = 15 * 60_000;

/** As coleções que a mudança alcança, cada uma com uma passada nova. */
const startReprojection = async (
  tenantId: string,
  screenId: string,
  before: Record<string, unknown> | undefined,
  after: Record<string, unknown> | undefined,
): Promise<void> => {
  const di = getDI();
  const collectionOf = (data: Record<string, unknown> | undefined) =>
    typeof data?.dataCollection === 'string' && data.dataCollection ? data.dataCollection : screenId;

  const screens = await di.getPortalRepository().getScreens(tenantId, { fresh: true });
  const own = [...new Set([collectionOf(before), collectionOf(after)])];
  const scope = portalReprojectionScope(screens, { screenId, collections: own });
  // Tela fora do portal antes e depois: dela, só os rótulos que mostram o título dela mudam.
  const collections = before?.portal || after?.portal ? scope : scope.filter((collection) => !own.includes(collection));
  if (collections.length > 0) await di.getStartPortalReprojectionUseCase().execute(tenantId, collections);
};

/**
 * A declaração de portal de uma tela mudou. Abre uma passada nas coleções que a mudança alcança — a
 * desta tela e as que chegam ao sujeito por ela, ou mostram o título dela (`portalReprojectionScope`) —
 * e não em todas as do portal. A passada anda sozinha, uma página por rodada (`runPortalReprojection`),
 * e por isso o tamanho da coleção não esbarra no tempo de uma invocação.
 *
 * É também aqui que uma passada que parou é acordada: mudar declaração é o que o escritório faz quando
 * mexe no portal, e a conferência custa uma leitura de coleção.
 */
export const reprojectPortalOnScreenChange = onDocumentWritten(
  { document: 'tenants/{tenantId}/screenDefinitions/{screenId}', region: REGION },
  async (event) => {
    const { tenantId, screenId } = event.params;
    const before = event.data?.before?.exists ? (event.data.before.data() as Record<string, unknown>) : undefined;
    const after = event.data?.after?.exists ? (event.data.after.data() as Record<string, unknown>) : undefined;
    const di = getDI();
    // Uma tela fora do portal também conta quando o que muda é o seu TÍTULO: ele pode ser o rótulo de
    // uma referência exposta (`referenceTitles`). Mudar só os campos dela não refaz nada.
    if (portalShape(before) !== portalShape(after) && (before?.portal || after?.portal)) {
      await startReprojection(tenantId, screenId, before, after);
    } else if ((before?.titleFieldKey ?? null) !== (after?.titleFieldKey ?? null)) {
      await startReprojection(tenantId, screenId, before, after);
    }
    await ensurePortalProjectionRevision(tenantId);
    try {
      await di.getNudgePortalReprojectionsUseCase().execute(tenantId);
    } catch (error) {
      console.error(`[portal] Falha ao acordar as reprojeções paradas de ${tenantId}:`, error);
    }
  },
);

/**
 * Uma rodada por gravação no job. A rodada fecha gravando o cursor — e é essa gravação que dispara a
 * seguinte. As gravações que não abrem rodada (a reserva, o fim da passada) saem sem fazer nada.
 */
export const runPortalReprojection = onDocumentWritten(
  {
    document: `tenants/{tenantId}/${PORTAL_REPROJECTIONS_COLLECTION}/{collection}`,
    region: REGION,
    retry: true,
    timeoutSeconds: 300,
    memory: '512MiB',
  },
  async (event) => {
    if (!event.data?.after.exists) return;
    if (Date.now() - new Date(event.time).getTime() > MAX_EVENT_AGE_MS) return;
    const { tenantId, collection } = event.params;
    await getDI().getRunPortalReprojectionRoundUseCase().execute(tenantId, collection);
  },
);
