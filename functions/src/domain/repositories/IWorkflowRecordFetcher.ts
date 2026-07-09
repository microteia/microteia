export interface IWorkflowRecordFetcher {
  fetchByIds: (
    tenantId: string,
    collection: string,
    ids: string[],
  ) => Promise<Map<string, Record<string, unknown> | null>>;
}
