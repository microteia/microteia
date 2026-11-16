export interface WorkflowDetectionDescriptor {
  id: string;
  description: string;
}

export interface DetectWorkflowsInput {
  tenantId: string;
  connectionId: string;
  text: string;
  workflows: WorkflowDetectionDescriptor[];
}

export interface RunWorkflowInput {
  tenantId: string;
  connectionId?: string;
  targetWorkflowId: string;
  text?: string;
  /** O nome do arquivo de onde o texto saiu — o parâmetro `fillFrom: 'sourceName'` o recebe. */
  sourceName?: string;
  providedParams?: Record<string, unknown>;
}

export interface IDataProcessorRepository {
  detectWorkflows(input: DetectWorkflowsInput): Promise<{ orderedWorkflowIds: string[] }>;
  runWorkflow(input: RunWorkflowInput): Promise<{ eventId: string }>;
}
