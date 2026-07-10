import type { WorkflowParameter, WorkflowParameterType } from './Workflow';

export interface ScriptOutputParam {
  key: string;
  label: string;
  type: WorkflowParameterType;
  entityType?: string;
}

export interface Script {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  sourceTs: string;
  compiledJs: string;
  inputParams: WorkflowParameter[];
  outputParams: ScriptOutputParam[];
  createdAt: Date;
  updatedAt: Date;
}
