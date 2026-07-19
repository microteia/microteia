import type { ActionDefinition, ActionOutcome, DeletionActor } from '../entities';

export type ActionDefinitionInput = Omit<
  ActionDefinition,
  'id' | 'tenantId' | 'createdAt' | 'updatedAt' | 'deletedBy' | 'deletedByName' | 'deletedByPhotoURL'
>;

export interface RunActionInput {
  tenantId: string;
  actionId: string;
  /** Tela que disparou a action ('persons', 'cases', ou o id da tela dinâmica). */
  source: string;
  context: Record<string, unknown>;
  recordId?: string | null;
  isNew: boolean;
}

export interface RunActionResult {
  outcome: ActionOutcome | null;
  executionId: string | null;
  error: string | null;
}

export interface IActionRepository {
  getAll(tenantId: string): Promise<ActionDefinition[]>;
  subscribeToActions(tenantId: string, onUpdate: (actions: ActionDefinition[]) => void): () => void;
  getById(tenantId: string, actionId: string): Promise<ActionDefinition | null>;
  create(tenantId: string, data: ActionDefinitionInput): Promise<ActionDefinition>;
  update(tenantId: string, actionId: string, data: Partial<ActionDefinitionInput>): Promise<void>;
  delete(tenantId: string, actionId: string, actor: DeletionActor): Promise<void>;
  runAction(input: RunActionInput): Promise<RunActionResult>;
}
