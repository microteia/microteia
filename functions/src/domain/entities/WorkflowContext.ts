import type { InputMapping, WorkflowEvent } from './Workflow';

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
  // Configuração bruta do step em execução. Permite que um step com inputs dinâmicos (ex:
  // 'Chamar Workflow') resolva chaves de configuração que resolveInputsSafe não conhece.
  stepConfiguration?: Record<string, InputMapping>;
}

export interface WorkflowResult {
  success: boolean;
  /** REFERÊNCIA de mensagem; `messageParams` traz o que a frase interpola. */
  message?: string;
  messageParams?: Record<string, string>;
  outputs?: Record<string, unknown>;
  // Encerra o workflow imediatamente após este step, atravessando ramos de condição e
  // repetições. O workflow retorna os outputs do último step executado antes do encerramento.
  halt?: boolean;
}
