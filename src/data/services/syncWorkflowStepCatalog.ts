import { httpsCallable } from 'firebase/functions';
import { functions } from '../../infrastructure/firebase/config';

const fn = httpsCallable<void, { success: boolean }>(functions, 'syncWorkflowStepCatalog');

export const syncWorkflowStepCatalog = async (): Promise<void> => {
  await fn();
};
