import { collection, doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../../infrastructure/firebase/config';
import { pruneUndefined } from '../utils/pruneUndefined';
import type { ISettingsRepository } from '../../domain/repositories/ISettingsRepository';
import type { SettingsScope, SettingsValues } from '../../domain/schema/settings';

const settingsRef = (tenantId: string) => collection(db, 'tenants', tenantId, 'settings');

/**
 * O id do documento de cada escopo. O do usuário leva o uid no nome (e não numa subcoleção) para que
 * a regra do Firestore consiga decidir a escrita só pelo caminho, sem ler o documento.
 */
export const settingsDocId = (scope: SettingsScope, userId: string): string =>
  scope === 'tenant' ? 'tenant' : `user_${userId}`;

const VALUES_FIELD = 'values';

export class FirebaseSettingsRepository implements ISettingsRepository {
  subscribe(
    tenantId: string,
    userId: string,
    onChange: (scope: SettingsScope, values: SettingsValues) => void,
  ): () => void {
    const scopes: SettingsScope[] = ['tenant', 'user'];
    const unsubs = scopes.map((scope) =>
      onSnapshot(
        doc(settingsRef(tenantId), settingsDocId(scope, userId)),
        (snap) => onChange(scope, (snap.data()?.[VALUES_FIELD] as SettingsValues) ?? {}),
        (error) => console.error(`[SettingsRepository] subscribe ${scope}:`, error.message),
      ),
    );
    return () => unsubs.forEach((unsub) => unsub());
  }

  async save(
    tenantId: string,
    userId: string,
    scope: SettingsScope,
    values: SettingsValues,
  ): Promise<void> {
    await setDoc(doc(settingsRef(tenantId), settingsDocId(scope, userId)), {
      scope,
      [VALUES_FIELD]: pruneUndefined(values),
      updatedAt: serverTimestamp(),
      updatedBy: userId,
    });
  }
}
