import type { ActionDefinition, ActionOutcome, DeletionActor } from '../entities';

export type ActionDefinitionInput = Omit<
  ActionDefinition,
  'id' | 'tenantId' | 'createdAt' | 'updatedAt' | 'deletedBy' | 'deletedByName' | 'deletedByPhotoURL'
>;

export interface RunActionInput {
  tenantId: string;
  actionId: string;
  /** Tela que disparou a action ('persons', 'contracts', ou o id da tela dinâmica). */
  source: string;
  context: Record<string, unknown>;
  recordId?: string | null;
  isNew: boolean;
  /**
   * Parâmetros que o USUÁRIO informou, quando a ação declara `promptParameters`. Chegam ao fluxo ao
   * lado dos cinco fixos, que sempre vencem: `action`, `source`, `context`, `recordId` e `isNew` são
   * do sistema, e um parâmetro de mesmo nome vindo daqui não os substitui.
   */
  params?: Record<string, unknown>;
}

export interface RunActionResult {
  outcome: ActionOutcome | null;
  executionId: string | null;
  /** REFERÊNCIA de mensagem; `errorParams` traz o que a frase interpola. */
  error: string | null;
  errorParams?: Record<string, string>;
}

export interface IActionRepository {
  getAll(tenantId: string): Promise<ActionDefinition[]>;
  subscribeToActions(tenantId: string, onUpdate: (actions: ActionDefinition[]) => void): () => void;
  getById(tenantId: string, actionId: string): Promise<ActionDefinition | null>;
  /**
   * `id` é o IDENTIFICADOR escolhido (`avisar-cliente`), e não um id gerado: é ele que a tela mostra
   * e que um pacote carrega. Ausente, o banco gera um — o caminho de quem ainda não escolheu.
   */
  create(tenantId: string, data: ActionDefinitionInput, id?: string): Promise<ActionDefinition>;
  update(tenantId: string, actionId: string, data: Partial<ActionDefinitionInput>): Promise<void>;
  delete(tenantId: string, actionId: string, actor: DeletionActor): Promise<void>;
  runAction(input: RunActionInput): Promise<RunActionResult>;
}
