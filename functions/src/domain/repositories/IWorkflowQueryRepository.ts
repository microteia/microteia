export interface WorkflowQueryRow {
  id: string;
  data: Record<string, unknown>;
}

export interface WorkflowEqualityFilter {
  path: string;
  value: unknown;
}

export interface IWorkflowQueryRepository {
  queryByEquality: (
    tenantId: string,
    collection: string,
    equalityFilters: WorkflowEqualityFilter[],
    limit: number,
  ) => Promise<WorkflowQueryRow[]>;
}
