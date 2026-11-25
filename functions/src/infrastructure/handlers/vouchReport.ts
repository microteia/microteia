import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { FieldValue } from 'firebase-admin/firestore';
import { getDI } from '../di/container';
import { getDb } from '../firebase/initFirebase';
import { requireAllPermissions, requirePermission } from './shared/requirePermission';
import { PERMISSION_EXTENSIONS_MANAGE, PERMISSION_REPORTS_MANAGE } from '../../domain/schema/access';
import { isRestrictedReport, reportVouchPermissions } from '../../domain/schema/report/reportDoor';
import { isSnapshotReport } from '../../domain/schema/report/reportSnapshot';
import type { ReportSpec } from '../../domain/schema/report/reportSpec';
import { FirestoreReportDefinitionReader } from '../../data/repositories/FirestoreReportDefinitionReader';

interface VouchReportRequest {
  tenantId?: string;
  reportId?: string;
}

/** O dono de um relatório de pacote: o `ownerPluginId`, ou o primeiro do refcount. */
const extensionOwnerOf = (data: Record<string, unknown>): string | null => {
  if (typeof data.ownerPluginId === 'string' && data.ownerPluginId) return data.ownerPluginId;
  const owners = data.ownerPluginIds;
  return Array.isArray(owners) && typeof owners[0] === 'string' ? owners[0] : null;
};

/**
 * AVALIZA um relatório restrito (#33): confere que quem responde por ele lê tudo o que ele toca e grava,
 * num campo que só o servidor escreve, a cópia do spec avalizado. É o aval que faz a porta abrir sem a
 * leitura das coleções de quem a abre — ver `reportDoor.ts`.
 *
 * Lê e grava numa TRANSAÇÃO: o spec conferido é exatamente o que fica avalizado, mesmo que outra pessoa
 * salve no meio. O relatório de extensão é avalizado pela instalação — quem instala tem
 * `extensions.manage`, que já instala fluxos que gravam em qualquer coleção.
 */
export const vouchReport = onCall(
  { region: 'southamerica-east1', cors: true },
  async (request): Promise<{ ok: true }> => {
    if (!request.auth) throw new HttpsError('unauthenticated', '@core.automation/handler.unauthenticated');
    const { tenantId, reportId } = (request.data ?? {}) as VouchReportRequest;
    if (!tenantId || !reportId || reportId.includes('/')) {
      throw new HttpsError('invalid-argument', '@core.automation/handler.params.missing');
    }
    const auth = request.auth;
    const db = getDb();
    const schema = await getDI().getScreenDefinitionCache().getSchemaContext(tenantId);
    const reports = new FirestoreReportDefinitionReader(db);
    const ref = db.doc(`tenants/${tenantId}/reports/${reportId}`);

    await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(ref);
      const data = snapshot.data();
      const spec = data?.spec as ReportSpec | undefined;
      if (!snapshot.exists || !data || !spec) {
        throw new HttpsError('not-found', '@core.reports/handler.not-found', { messageParams: { id: reportId } });
      }
      if (!isRestrictedReport({ ownerId: null, spec })) {
        throw new HttpsError('failed-precondition', '@core.reports/vouch.not-restricted');
      }

      const extension = extensionOwnerOf(data);
      let by: string;
      if (extension) {
        await requirePermission(tenantId, auth, PERMISSION_EXTENSIONS_MANAGE);
        by = `extension:${extension}`;
      } else {
        await requirePermission(tenantId, auth, PERMISSION_REPORTS_MANAGE);
        const source = isSnapshotReport(spec) ? (await reports.find(tenantId, spec.dataset.table))?.spec : undefined;
        const required = reportVouchPermissions(spec, schema, source);
        if (required === null) {
          throw new HttpsError('failed-precondition', '@core.reports/snapshot.source-missing', { messageParams: { report: spec.dataset.table } });
        }
        await requireAllPermissions(tenantId, auth, required);
        by = auth.uid;
      }

      transaction.update(ref, { vouch: { by, at: FieldValue.serverTimestamp(), spec } });
    });

    return { ok: true };
  },
);
