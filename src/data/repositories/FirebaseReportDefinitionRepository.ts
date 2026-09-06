import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../../infrastructure/firebase/config';
import type {
  IReportDefinitionRepository,
  ReportDefinitionInput,
  RunReportInput,
  RunReportResult,
} from '../../domain/repositories/IReportDefinitionRepository';
import type { ReportDefinition } from '../../domain/entities/Report';
import type { ReportSpec } from '../../domain/schema/report/reportSpec';
import { LocalizedError } from '../../domain/errors/LocalizedError';

const toDate = (v: unknown): Date => (v instanceof Timestamp ? v.toDate() : (v as Date));

const reportsRef = (tenantId: string) => collection(db, 'tenants', tenantId, 'reports');

/**
 * O `spec` é lido e gravado VERBATIM.
 *
 * Não há mapeamento campo a campo aqui, e é a única forma de a regra valer: uma chave que este kernel
 * não conhece precisa sobreviver à ida e volta, senão um relatório editado numa versão mais velha
 * perde em silêncio o que uma mais nova escreveu. Um mapper que enumerasse propriedades mataria essa
 * garantia no primeiro save, e nada acusaria.
 */
const mapReport = (id: string, d: Record<string, unknown>, tenantId: string): ReportDefinition => ({
  id,
  tenantId,
  key: (d.key as string | undefined) ?? id,
  title: (d.title as string | undefined) ?? '',
  description: (d.description as string | null | undefined) ?? null,
  icon: (d.icon as string | null | undefined) ?? null,
  spec: d.spec as ReportSpec,
  origin: (d.origin as ReportDefinition['origin'] | undefined) ?? 'design',
  ownerPluginId: (d.ownerPluginId as string | null | undefined) ?? null,
  ownerPluginIds: (d.ownerPluginIds as string[] | null | undefined) ?? null,
  sourceId: (d.sourceId as string | null | undefined) ?? null,
  sourceRev: (d.sourceRev as number | null | undefined) ?? null,
  managed: (d.managed as boolean | null | undefined) ?? null,
  enabled: (d.enabled as boolean | undefined) ?? true,
  hideFromSidebar: (d.hideFromSidebar as boolean | null | undefined) ?? null,
  sidebarOrder: (d.sidebarOrder as number | null | undefined) ?? null,
  createdBy: (d.createdBy as string | null | undefined) ?? null,
  createdAt: toDate(d.createdAt),
  updatedAt: toDate(d.updatedAt),
});

// O Firestore rejeita `undefined`, e um campo opcional ausente chega assim. Ausente some;
// para limpar um valor gravado, use `null`.
const stripUndefined = <T extends object>(data: T): T =>
  Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined)) as T;

const ordered = (tenantId: string) => query(reportsRef(tenantId), orderBy('title', 'asc'));

export class FirebaseReportDefinitionRepository implements IReportDefinitionRepository {
  async getAll(tenantId: string): Promise<ReportDefinition[]> {
    const snap = await getDocs(ordered(tenantId));
    return snap.docs.map((d) => mapReport(d.id, d.data(), tenantId));
  }

  subscribeToReports(tenantId: string, onUpdate: (reports: ReportDefinition[]) => void): () => void {
    return onSnapshot(ordered(tenantId), (snap) => {
      onUpdate(snap.docs.map((d) => mapReport(d.id, d.data(), tenantId)));
    });
  }

  async getById(tenantId: string, reportId: string): Promise<ReportDefinition | null> {
    const snap = await getDoc(doc(reportsRef(tenantId), reportId));
    return snap.exists() ? mapReport(snap.id, snap.data(), tenantId) : null;
  }

  async create(tenantId: string, data: ReportDefinitionInput, id?: string): Promise<ReportDefinition> {
    const payload = {
      ...stripUndefined(data),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    if (id) {
      const ref = doc(reportsRef(tenantId), id);
      if ((await getDoc(ref)).exists()) {
        throw new LocalizedError('@core.reports/artifact.id-taken', { id });
      }
      await setDoc(ref, payload);
      const snap = await getDoc(ref);
      return mapReport(id, snap.data() as Record<string, unknown>, tenantId);
    }

    const ref = await addDoc(reportsRef(tenantId), payload);
    const snap = await getDoc(ref);
    return mapReport(ref.id, snap.data() as Record<string, unknown>, tenantId);
  }

  async update(tenantId: string, reportId: string, data: Partial<ReportDefinitionInput>): Promise<void> {
    const updatable = stripUndefined({ ...data });
    delete updatable.createdBy;
    await updateDoc(doc(reportsRef(tenantId), reportId), { ...updatable, updatedAt: serverTimestamp() });
  }

  async delete(tenantId: string, reportId: string): Promise<void> {
    await deleteDoc(doc(reportsRef(tenantId), reportId));
  }

  async runReport(input: RunReportInput): Promise<RunReportResult> {
    const call = httpsCallable<RunReportInput, RunReportResult>(functions, 'runReport');
    const response = await call(input);
    return response.data;
  }
}
