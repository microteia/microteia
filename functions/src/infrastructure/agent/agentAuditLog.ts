import { Timestamp } from 'firebase-admin/firestore';
import type { DocumentSnapshot, Query, QueryDocumentSnapshot } from 'firebase-admin/firestore';
import type { MessageCatalog } from '../../domain/schema/i18n/messages';
import { AGENT_SEARCH_MAX_RESULTS } from '../../domain/schema/agent/agentOps';
import { getDb } from '../firebase/initFirebase';
import { agentText } from './agentMessages';

/**
 * A leitura do log de auditoria por um agente.
 *
 * O log não é coleção de tela: mora fora do escritório, em `auditLogs`, com o `tenantId` no
 * documento — e por isso `search_records` nunca o alcançaria, por mais que o acesso tivesse
 * `audit.read`. A consulta usa SÓ o índice que a tela de Auditoria já usa (`tenantId` + `createdAt`
 * desc); o resto dos filtros é aplicado em memória sobre a janela varrida, como `search_records`
 * faz, e `complete` diz ao modelo quando a janela não bastou.
 */
const AUDIT_SCAN_PAGE = 500;
const AUDIT_MAX_SCAN = 2000;

const BARE_DAY = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 24 * 60 * 60 * 1000;

/** `YYYY-MM-DD` é o dia inteiro em UTC: `since` abre no começo dele, `until` fecha no fim. */
export const parseAuditBound = (value: unknown, edge: 'since' | 'until'): Date | null | undefined => {
  if (value === undefined) return undefined;
  const text = typeof value === 'string' ? value.trim() : '';
  if (BARE_DAY.test(text)) {
    const start = new Date(`${text}T00:00:00.000Z`);
    if (Number.isNaN(start.getTime())) return null;
    return edge === 'since' ? start : new Date(start.getTime() + DAY_MS - 1);
  }
  const instant = new Date(text);
  return text === '' || Number.isNaN(instant.getTime()) ? null : instant;
};

const EQUALITY_FILTERS = ['action', 'severity', 'type', 'entity', 'entityId', 'userId'] as const;

export const matchesAuditFilters = (
  entry: Record<string, unknown>,
  input: Record<string, unknown>,
): boolean =>
  EQUALITY_FILTERS.every((key) => typeof input[key] !== 'string' || entry[key] === input[key]);

const toIso = (value: unknown): string | null =>
  value instanceof Timestamp ? value.toDate().toISOString() : null;

const describeEntry = (
  id: string,
  data: Record<string, unknown>,
  catalog: MessageCatalog,
): Record<string, unknown> => ({
  id,
  createdAt: toIso(data.createdAt),
  action: data.action,
  severity: data.severity,
  type: data.type,
  entity: data.entity,
  entityId: data.entityId,
  ...(data.linkCollection ? { collection: data.linkCollection, recordId: data.linkRecordId } : {}),
  user: { id: data.userId, name: data.userName },
  // O título e o texto são gravados como REFERÊNCIA; resolvidos aqui, como o log do motor em
  // `get_workflow_run` — sem isto o agente leria a chave do catálogo como se fosse o fato.
  title: agentText(catalog, String(data.title ?? ''), data.titleParams as Record<string, string> | undefined),
  text: agentText(catalog, String(data.text ?? ''), data.textParams as Record<string, string> | undefined),
});

export type AuditLogSearchOutcome =
  | { ok: true; value: unknown }
  | { ok: false; error: string; params?: Record<string, string> };

export const searchAuditLog = async (
  input: Record<string, unknown>,
  tenantId: string,
  catalog: MessageCatalog,
): Promise<AuditLogSearchOutcome> => {
  const since = parseAuditBound(input.since, 'since');
  if (since === null) return { ok: false, error: '@core.access/agent.audit.date-invalid', params: { path: 'since' } };
  const until = parseAuditBound(input.until, 'until');
  if (until === null) return { ok: false, error: '@core.access/agent.audit.date-invalid', params: { path: 'until' } };

  const limit = typeof input.limit === 'number' ? input.limit : AGENT_SEARCH_MAX_RESULTS;

  let base: Query = getDb().collection('auditLogs').where('tenantId', '==', tenantId);
  if (since) base = base.where('createdAt', '>=', Timestamp.fromDate(since));
  if (until) base = base.where('createdAt', '<=', Timestamp.fromDate(until));
  base = base.orderBy('createdAt', 'desc');

  const entries: Record<string, unknown>[] = [];
  let scanned = 0;
  let exhausted = false;
  let cursor: DocumentSnapshot | null = null;

  while (entries.length < limit && scanned < AUDIT_MAX_SCAN) {
    const size = Math.min(AUDIT_SCAN_PAGE, AUDIT_MAX_SCAN - scanned);
    const page: Query = cursor ? base.startAfter(cursor) : base;
    const docs: QueryDocumentSnapshot[] = (await page.limit(size).get()).docs;
    let read = 0;
    while (read < docs.length && entries.length < limit) {
      const data = docs[read].data();
      if (matchesAuditFilters(data, input)) entries.push(describeEntry(docs[read].id, data, catalog));
      read += 1;
    }
    scanned += read;
    if (read === docs.length && docs.length < size) {
      exhausted = true;
      break;
    }
    cursor = docs[read - 1] ?? cursor;
  }

  return {
    ok: true,
    value: {
      entries,
      count: entries.length,
      scanned,
      complete: exhausted,
    },
  };
};
