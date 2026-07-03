export interface LogClientErrorInput {
  tenantId: string;
  title: string;
  entity: string;
  entityId?: string;
  entityLink?: string;
  error: unknown;
}

export interface IAuditLogService {
  logError(input: LogClientErrorInput): Promise<void>;
}
