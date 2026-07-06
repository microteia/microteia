import type { WorkflowEvent } from './Workflow';

export interface WorkflowLogger {
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
}

export interface WorkflowServices {
  logger: WorkflowLogger;
  now(): Date;
}

export interface WorkflowContext {
  event: WorkflowEvent;
  outputs: Record<string, Record<string, unknown>>;
  variables: Record<string, unknown>;
  services: WorkflowServices;
  logger: WorkflowLogger;
  execution: {
    id: string;
    workflowDefinitionId: string;
    tenantId: string;
  };
  input?: Record<string, unknown>;
}

export interface WorkflowResult {
  success: boolean;
  message?: string;
  outputs?: Record<string, unknown>;
}
