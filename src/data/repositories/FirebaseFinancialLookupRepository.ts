import { collection, getDocs, orderBy, query, addDoc, deleteDoc, doc, where } from 'firebase/firestore';
import { db } from '../../infrastructure/firebase/config';
import type { IFinancialLookupRepository } from '../../domain/repositories/IFinancialLookupRepository';
import type { FinancialLookupConfig, FinancialLookupKind } from '../../domain/entities';

const COLLECTION_NAMES: Record<FinancialLookupKind, string> = {
  categories: 'financialCategories',
  statuses:   'financialStatuses',
};

const STATIC_DEFAULTS: Record<FinancialLookupKind, FinancialLookupConfig[]> = {
  categories: [
    { key: 'Honorários',       label: 'Honorários',       isStatic: true },
    { key: 'Êxito',            label: 'Êxito',            isStatic: true },
    { key: 'Mensalidade',      label: 'Mensalidade',      isStatic: true },
    { key: 'Custas Judiciais', label: 'Custas Judiciais', isStatic: true },
    { key: 'Perícia',          label: 'Perícia',          isStatic: true },
    { key: 'Deslocamento',     label: 'Deslocamento',     isStatic: true },
    { key: 'Escritório',       label: 'Escritório',       isStatic: true },
    { key: 'Impostos',         label: 'Impostos',         isStatic: true },
    { key: 'Outros',           label: 'Outros',           isStatic: true },
  ],
  statuses: [
    { key: 'Pendente',  label: 'Pendente',  color: 'warning',       isStatic: true },
    { key: 'Pago',      label: 'Pago',      color: 'success',       isStatic: true },
    { key: 'Vencido',   label: 'Vencido',   color: 'danger',        isStatic: true },
    { key: 'Cancelado', label: 'Cancelado', color: 'textSecondary', isStatic: true },
  ],
};

export class FirebaseFinancialLookupRepository implements IFinancialLookupRepository {
  async getAll(tenantId: string, kind: FinancialLookupKind): Promise<FinancialLookupConfig[]> {
    try {
      const col = collection(db, 'tenants', tenantId, COLLECTION_NAMES[kind]);
      const q = query(col, orderBy('label', 'asc'));
      const snap = await getDocs(q);
      const dynamic = snap.docs.map((d) => ({
        key:      d.data().key   as string,
        label:    d.data().label as string,
        color:    d.data().color as string | undefined,
        isStatic: false,
      }));
      const dynamicKeys = new Set(dynamic.map((a) => a.key));
      const statics = STATIC_DEFAULTS[kind].filter((s) => !dynamicKeys.has(s.key));
      return [...statics, ...dynamic].sort((a, b) => a.label.localeCompare(b.label));
    } catch {
      return STATIC_DEFAULTS[kind];
    }
  }

  async create(tenantId: string, kind: FinancialLookupKind, name: string, createdBy: string, color?: string): Promise<FinancialLookupConfig> {
    const col = collection(db, 'tenants', tenantId, COLLECTION_NAMES[kind]);
    const data: Record<string, unknown> = { key: name, label: name, createdBy, createdAt: new Date() };
    if (color) data.color = color;
    await addDoc(col, data);
    return { key: name, label: name, color };
  }

  async delete(tenantId: string, kind: FinancialLookupKind, key: string): Promise<void> {
    const col = collection(db, 'tenants', tenantId, COLLECTION_NAMES[kind]);
    const q = query(col, where('key', '==', key));
    const snap = await getDocs(q);
    await Promise.all(snap.docs.map((d) => deleteDoc(doc(col, d.id))));
  }
}
