import { collection, orderBy, query, onSnapshot } from 'firebase/firestore';
import { db } from '../../infrastructure/firebase/config';
import type { IStepCatalogRepository } from '../../domain/repositories/IStepCatalogRepository';
import type { StepDefinitionSummary } from '../../domain/entities/WorkflowStepCatalog';

export class FirebaseStepCatalogRepository implements IStepCatalogRepository {
  subscribeToStepCatalog(onUpdate: (catalog: StepDefinitionSummary[]) => void): () => void {
    const q = query(collection(db, 'workflow_step_catalog'), orderBy('name', 'asc'));
    return onSnapshot(
      q,
      (snap) => onUpdate(snap.docs.map((d) => d.data() as StepDefinitionSummary)),
      (error) => console.error('[StepCatalogRepository] subscribeToStepCatalog:', error.message),
    );
  }
}
