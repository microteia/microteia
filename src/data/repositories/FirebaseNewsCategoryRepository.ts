import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import { db } from '../../infrastructure/firebase/config';
import type { INewsCategoryRepository } from '../../domain/repositories/INewsCategoryRepository';
import type { NewsCategoryConfig } from '../../domain/entities';

const COL = 'newsCategories';

const DEFAULT_NEWS_CATEGORIES: NewsCategoryConfig[] = [
  { key: 'GENERAL',       label: 'Geral' },
  { key: 'JURISPRUDENCE', label: 'Jurisprudência' },
  { key: 'LEGISLATION',   label: 'Legislação' },
  { key: 'DOCTRINE',      label: 'Doutrina' },
  { key: 'ANNOUNCEMENT',  label: 'Comunicado' },
];

export class FirebaseNewsCategoryRepository implements INewsCategoryRepository {
  async getAll(): Promise<NewsCategoryConfig[]> {
    try {
      const q = query(collection(db, COL), orderBy('order', 'asc'));
      const snap = await getDocs(q);
      if (snap.empty) return DEFAULT_NEWS_CATEGORIES;
      return snap.docs.map((d) => ({
        key:   d.data().key   as string,
        label: d.data().label as string,
      }));
    } catch {
      return DEFAULT_NEWS_CATEGORIES;
    }
  }
}
