export type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE' | 'SYSTEM';
export type AuditSeverity = 'LOW' | 'HIGH' | 'CRITICAL';
export type AuditType = 'AUDIT' | 'ERROR';

export interface AuditLog {
  id: string;
  tenantId: string;
  title: string;
  userId: string;
  userName: string;
  photoURL: string;
  action: AuditAction;
  severity: AuditSeverity;
  type: AuditType;
  entity: string;
  entityId: string;
  entityLink?: string;
  text: string;
  createdAt: Date;
  expiresAt: Date;
}
