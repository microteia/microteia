import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  updateDoc,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../../infrastructure/firebase/config';
import { publicExtensionFromDoc } from './publicExtensionMapping';
import { DependencyRangeRefusal } from '../../domain/usecases/plugins/crossExtensionRefs';
import type {
  IPublicExtensionRepository,
  PublishExtensionOptions,
  PublishExtensionOutcome,
} from '../../domain/repositories/IPublicExtensionRepository';
import type { PublicExtension, PublicExtensionStatus } from '../../domain/entities/PublicExtension';
import type { LocalizedIssue } from '../../domain/usecases/plugins/pluginReferences';

const publicRef = () => collection(db, 'public_extensions');

/**
 * As dependentes que a versão deixaria fora da faixa chegam como `details.issues` da callable. Viram a
 * MESMA recusa que a instalação usa para perguntar — e por isso a tela de Extensões as mostra no mesmo
 * diálogo, sem um segundo caminho de consentimento.
 */
const consentIssuesOf = (error: unknown): LocalizedIssue[] | null => {
  const details = (error as { details?: unknown } | null)?.details;
  const issues = (details as { issues?: unknown } | null | undefined)?.issues;
  if (!Array.isArray(issues) || issues.length === 0) return null;
  return issues.flatMap((issue): LocalizedIssue[] => {
    const entry = issue as { message?: unknown; messageParams?: unknown };
    if (typeof entry.message !== 'string') return [];
    const params = entry.messageParams;
    return [typeof params === 'object' && params !== null
      ? { message: entry.message, messageParams: params as Record<string, string> }
      : { message: entry.message }];
  });
};

export class FirebasePublicExtensionRepository implements IPublicExtensionRepository {
  subscribe(onChange: (items: PublicExtension[]) => void): () => void {
    return onSnapshot(
      publicRef(),
      (snap) => onChange(snap.docs.map((s) => publicExtensionFromDoc(s.id, s.data()))),
      (error) => console.error('[PublicExtensionRepository] subscribe:', error.message),
    );
  }

  async publish(tenantId: string, pluginId: string, options?: PublishExtensionOptions): Promise<PublishExtensionOutcome> {
    const call = httpsCallable<
      { tenantId: string; pluginId: string; acceptDependentRanges: boolean },
      PublishExtensionOutcome
    >(functions, 'publishExtension');
    try {
      return (await call({ tenantId, pluginId, acceptDependentRanges: options?.acceptDependentRanges === true })).data;
    } catch (error) {
      const issues = consentIssuesOf(error);
      if (issues) throw new DependencyRangeRefusal(issues);
      throw error;
    }
  }

  async setStatus(domain: string, status: PublicExtensionStatus): Promise<void> {
    await updateDoc(doc(publicRef(), domain), { status });
  }

  async delete(domain: string): Promise<void> {
    await deleteDoc(doc(publicRef(), domain));
  }
}
