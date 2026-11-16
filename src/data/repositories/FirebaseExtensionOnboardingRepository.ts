import { arrayRemove, arrayUnion, doc, onSnapshot, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '../../infrastructure/firebase/config';
import type { IExtensionOnboardingRepository } from '../../domain/repositories/IExtensionOnboardingRepository';
import {
  DEFAULT_EXTENSIONS_ONBOARDING_DOC,
  EXTENSION_ONBOARDING_COLLECTION,
  defaultExtensionsOnboardingOf,
  type DefaultExtensionsOnboarding,
} from '../../domain/schema/plugin/defaultExtensions';

const onboardingRef = (tenantId: string) =>
  doc(db, 'tenants', tenantId, EXTENSION_ONBOARDING_COLLECTION, DEFAULT_EXTENSIONS_ONBOARDING_DOC);

export class FirebaseExtensionOnboardingRepository implements IExtensionOnboardingRepository {
  subscribe(
    tenantId: string,
    onChange: (onboarding: DefaultExtensionsOnboarding | null) => void,
    onError: (error: Error) => void,
  ): () => void {
    return onSnapshot(
      onboardingRef(tenantId),
      (snap) => onChange(snap.exists() ? defaultExtensionsOnboardingOf(snap.data()) : null),
      onError,
    );
  }

  async settle(tenantId: string, pluginId: string, outcome: 'installed' | 'deferred'): Promise<void> {
    await updateDoc(onboardingRef(tenantId), {
      pending: arrayRemove(pluginId),
      ...(outcome === 'deferred' ? { failed: arrayUnion(pluginId) } : {}),
      updatedAt: serverTimestamp(),
    });
  }
}
