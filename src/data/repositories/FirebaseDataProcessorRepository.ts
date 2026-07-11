import { httpsCallable } from 'firebase/functions';
import { functions } from '../../infrastructure/firebase/config';
import type {
  IDataProcessorRepository,
  DetectWorkflowsInput,
  RunWorkflowInput,
} from '../../domain/repositories/IDataProcessorRepository';

export class FirebaseDataProcessorRepository implements IDataProcessorRepository {
  async detectWorkflows(input: DetectWorkflowsInput): Promise<{ orderedWorkflowIds: string[] }> {
    const call = httpsCallable<DetectWorkflowsInput, { orderedWorkflowIds: string[] }>(
      functions,
      'detectWorkflows',
    );
    const result = await call(input);
    return result.data;
  }

  async runWorkflow(input: RunWorkflowInput): Promise<{ eventId: string }> {
    const call = httpsCallable<RunWorkflowInput, { eventId: string }>(functions, 'runWorkflow');
    const result = await call(input);
    return result.data;
  }
}
