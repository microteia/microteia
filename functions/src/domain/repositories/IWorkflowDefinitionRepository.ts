import type { WorkflowDefinition } from '../entities/Workflow';

export interface IWorkflowDefinitionRepository {
  findEnabledByEvent(tenantId: string, eventName: string): Promise<WorkflowDefinition[]>;
  findEnabledByEvents(tenantId: string, eventNames: string[]): Promise<WorkflowDefinition[]>;
  findById(tenantId: string, id: string): Promise<WorkflowDefinition | null>;
  /** O id local, ou a referência qualificada a uma automação de outra extensão. Ver `IScriptRepository`. */
  findByRef(tenantId: string, ref: string): Promise<WorkflowDefinition | null>;
}
