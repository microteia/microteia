export interface IWorkflowMutationRepository {
  getById: (
    tenantId: string,
    collection: string,
    id: string,
  ) => Promise<Record<string, unknown> | null>;
  create: (
    tenantId: string,
    collection: string,
    data: Record<string, unknown>,
    id?: string,
  ) => Promise<string>;
  update: (
    tenantId: string,
    collection: string,
    id: string,
    data: Record<string, unknown>,
  ) => Promise<void>;
  delete: (tenantId: string, collection: string, id: string) => Promise<void>;
}
