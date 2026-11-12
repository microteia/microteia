import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../../infrastructure/firebase/config';
import type { IPersonalReportRepository, PersonalReportInput } from '../../domain/repositories/IPersonalReportRepository';
import type { ReportDefinition } from '../../domain/entities/Report';
import { PERSONAL_REPORTS_COLLECTION } from '../../domain/schema/report/personalReport';
import { LocalizedError } from '../../domain/errors/LocalizedError';
import { mapReport, stripUndefined } from './FirebaseReportDefinitionRepository';

const personalRef = (tenantId: string) => collection(db, 'tenants', tenantId, PERSONAL_REPORTS_COLLECTION);

/**
 * Só os do autor, e pela consulta — não por filtro na tela: a regra recusa a leitura que PODERIA trazer
 * o relatório de outro membro. Sem `orderBy`: com ele a consulta pediria índice composto, e a lista de
 * uma pessoa é curta o bastante para ordenar aqui.
 */
const mine = (tenantId: string, ownerId: string) => query(personalRef(tenantId), where('ownerId', '==', ownerId));

const byTitle = (a: ReportDefinition, b: ReportDefinition): number => a.title.localeCompare(b.title);

export class FirebasePersonalReportRepository implements IPersonalReportRepository {
  subscribe(tenantId: string, ownerId: string, onUpdate: (reports: ReportDefinition[]) => void): () => void {
    return onSnapshot(mine(tenantId, ownerId), (snap) => {
      onUpdate(snap.docs.map((d) => mapReport(d.id, d.data(), tenantId)).sort(byTitle));
    });
  }

  async getAll(tenantId: string, ownerId: string): Promise<ReportDefinition[]> {
    const snap = await getDocs(mine(tenantId, ownerId));
    return snap.docs.map((d) => mapReport(d.id, d.data(), tenantId)).sort(byTitle);
  }

  async create(tenantId: string, ownerId: string, data: PersonalReportInput): Promise<ReportDefinition> {
    const ref = await addDoc(personalRef(tenantId), {
      ...stripUndefined(data),
      ownerId,
      createdBy: ownerId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    const snap = await getDoc(ref);
    return mapReport(ref.id, snap.data() as Record<string, unknown>, tenantId);
  }

  async update(tenantId: string, reportId: string, data: Partial<PersonalReportInput>): Promise<void> {
    const updatable: Record<string, unknown> = stripUndefined({ ...data });
    delete updatable.ownerId;
    delete updatable.createdBy;
    await updateDoc(doc(personalRef(tenantId), reportId), { ...updatable, updatedAt: serverTimestamp() });
  }

  async delete(tenantId: string, reportId: string): Promise<void> {
    await deleteDoc(doc(personalRef(tenantId), reportId));
  }

  async share(tenantId: string, reportId: string, key: string): Promise<void> {
    const source = await getDoc(doc(personalRef(tenantId), reportId));
    if (!source.exists()) throw new LocalizedError('@core.reports/handler.not-found', { id: reportId });
    const target = doc(db, 'tenants', tenantId, 'reports', key);
    if ((await getDoc(target)).exists()) throw new LocalizedError('@core.reports/artifact.id-taken', { id: key });

    // O relatório do escritório não tem dono: `ownerId` sai, e quem o criou fica em `createdBy`.
    const rest: Record<string, unknown> = { ...source.data() };
    delete rest.ownerId;
    const batch = writeBatch(db);
    batch.set(target, { ...rest, key, origin: 'design', createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
    batch.delete(source.ref);
    await batch.commit();
  }
}
