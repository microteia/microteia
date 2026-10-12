import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '../../infrastructure/firebase/config';
import { mergeLookupDefaults } from '../../domain/schema/lookupDefaults';

interface LookupLike {
  key: string;
  label: string;
}

export const subscribeLookupCollection = <T extends LookupLike>(
  tenantId: string,
  collectionName: string,
  statics: T[],
  onChange: (items: T[]) => void,
): (() => void) => {
  const col = collection(db, 'tenants', tenantId, collectionName);
  const q = query(col, orderBy('label', 'asc'));
  return onSnapshot(
    q,
    (snap) => {
      const dynamic = snap.docs.map((d) => ({
        key:      d.data().key   as string,
        label:    d.data().label as string,
        color:    d.data().color as string | undefined,
        isStatic: false,
      })) as unknown as T[];
      onChange(mergeLookupDefaults(statics, dynamic));
    },
    () => onChange(statics),
  );
};
