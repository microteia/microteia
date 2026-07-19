import { collection, getDocs, orderBy, query, addDoc, deleteDoc, doc, where } from 'firebase/firestore';
import { db } from '../../infrastructure/firebase/config';
import type { INewsCategoryRepository } from '../../domain/repositories/INewsCategoryRepository';
import type { NewsCategoryConfig } from '../../domain/entities';
import { mergeLookupDefaults } from './mergeLookupDefaults';
import { subscribeLookupCollection } from './subscribeLookupCollection';

const DEFAULT_NEWS_CATEGORIES: NewsCategoryConfig[] = [
  { key: 'GENERAL',       label: 'Geral',          isStatic: true },
  { key: 'JURISPRUDENCE', label: 'Jurisprudência', isStatic: true },
  { key: 'LEGISLATION',   label: 'Legislação',     isStatic: true },
  { key: 'ANNOUNCEMENT',  label: 'Comunicado',     isStatic: true },
  { key: 'CIRCULAR',      label: 'Circular',       isStatic: true },
  { key: 'UPDATE',        label: 'Atualização',    isStatic: true },
];

export class FirebaseNewsCategoryRepository implements INewsCategoryRepository {
  subscribe(tenantId: string, onChange: (items: NewsCategoryConfig[]) => void): () => void {
    return subscribeLookupCollection<NewsCategoryConfig>(tenantId, 'newsCategories', DEFAULT_NEWS_CATEGORIES, onChange);
  }

  async getAll(tenantId: string): Promise<NewsCategoryConfig[]> {
    try {
      const col = collection(db, 'tenants', tenantId, 'newsCategories');
      const q = query(col, orderBy('label', 'asc'));
      const snap = await getDocs(q);
      const dynamicCategories = snap.docs.map((d) => ({
        key:      d.data().key   as string,
        label:    d.data().label as string,
        isStatic: false,
      }));
      return mergeLookupDefaults(DEFAULT_NEWS_CATEGORIES, dynamicCategories);
    } catch {
      return DEFAULT_NEWS_CATEGORIES;
    }
  }

  async create(tenantId: string, key: string, label: string, createdBy: string): Promise<NewsCategoryConfig> {
    const col = collection(db, 'tenants', tenantId, 'newsCategories');
    await addDoc(col, { key, label, createdBy, createdAt: new Date() });
    return { key, label, isStatic: false };
  }

  async delete(tenantId: string, key: string): Promise<void> {
    const col = collection(db, 'tenants', tenantId, 'newsCategories');
    const q = query(col, where('key', '==', key));
    const snap = await getDocs(q);
    const promises = snap.docs.map((d) => deleteDoc(doc(col, d.id)));
    await Promise.all(promises);
  }
}
