import type { AuditAction, AuditLog, AuditSeverity, ScreenDefinition } from '../../../domain/entities';
import type { TranslateFn, useLabel } from '../../shared/i18n/useT';
import { AUDIT_RETENTION_COLLECTION } from '../../../domain/schema/auditRetention';
import { MFA_AUDIT_ENTITY } from '../../../domain/schema/memberMfa';

/**
 * As entidades que o backend audita por nome próprio HOJE — nada além disso.
 *
 * Quem tem tela não entra aqui: o log guarda a COLEÇÃO, e o nome vem
 * da tela que a descreve, resolvido em `entityLabel`. Assim o rótulo acompanha o título quando a
 * tela é renomeada, em vez de congelar o nome do dia da gravação.
 */
export const ENTITY_KEYS: Record<string, string> = {
  Role: 'audit.entity.role',
  TenantMember: 'audit.entity.tenant-member',
  CustomRecordTag: 'audit.entity.custom-record-tag',
  CustomRecordDocument: 'audit.entity.custom-record-document',
  RecordNote: 'audit.entity.record-note',
  ScreenDefinition: 'audit.entity.screen-definition',
  PortalText: 'audit.entity.portal-text',
  Tenant: 'audit.entity.tenant',
  Workflow: 'audit.entity.workflow',
  [AUDIT_RETENTION_COLLECTION]: 'audit.entity.audit-retention',
  [MFA_AUDIT_ENTITY]: 'audit.entity.member-mfa',
  FRONTEND: 'audit.entity.frontend',
  SYSTEM: 'audit.entity.system',
};

export const ACTION_KEYS: Record<AuditAction, string> = {
  CREATE: 'audit.action.create',
  UPDATE: 'audit.action.update',
  DELETE: 'audit.action.delete',
  SYSTEM: 'audit.action.system',
};

export const SEVERITY_KEYS: Record<AuditSeverity, string> = {
  LOW: 'audit.severity.low',
  HIGH: 'audit.severity.high',
  CRITICAL: 'audit.severity.critical',
};

const NESTED_PART_KEYS: Record<string, string> = {
  notes: 'audit.entity.note-of',
  documents: 'audit.entity.document-of',
};

const screenTitle = (screens: ScreenDefinition[], collection: string): ScreenDefinition | undefined =>
  screens.find((screen) => (screen.dataCollection ?? screen.id) === collection);

/**
 * O rótulo da entidade auditada. A chave fixa tem nome no código; a de tela declarada é a coleção
 * (`contracts`, `contracts#notes`) e recebe o nome da tela que a descreve HOJE — assim o log
 * acompanha o título quando a tela é renomeada, em vez de congelar o nome do dia da gravação.
 */
export const entityLabel = (
  t: TranslateFn,
  resolve: (value: string) => string,
  entity: string,
  screens: ScreenDefinition[] = [],
): string => {
  const [collection, part] = entity.split('#');
  const screen = screenTitle(screens, collection);
  if (!screen) {
    const key = ENTITY_KEYS[entity];
    return key ? t(key) : entity;
  }
  const nestedKey = part ? NESTED_PART_KEYS[part] : undefined;
  return nestedKey ? t(nestedKey, { name: screen.titleSingular }) : resolve(screen.titleSingular);
};

export interface EntityFilterOption {
  value: string;
  label: string;
}

/** As opções do filtro por entidade: as fixas do kernel mais o que o escritório declara. */
export const entityFilterOptions = (
  t: TranslateFn,
  resolve: (value: string) => string,
  screens: ScreenDefinition[] = [],
): EntityFilterOption[] => {
  const options = Object.entries(ENTITY_KEYS).map(([value, key]) => ({ value, label: t(key) }));
  for (const screen of screens) {
    const collection = screen.dataCollection ?? screen.id;
    options.push({ value: collection, label: resolve(screen.titleSingular) });
    if (screen.hasNotes) {
      options.push({
        value: `${collection}#notes`,
        label: t('audit.entity.note-of', { name: screen.titleSingular }),
      });
    }
    if (screen.hasDocuments) {
      options.push({
        value: `${collection}#documents`,
        label: t('audit.entity.document-of', { name: screen.titleSingular }),
      });
    }
  }
  return options;
};

type LabelFn = ReturnType<typeof useLabel>;

export interface PresentedAuditLog {
  log: AuditLog;
  entityLabel: string;
}

/**
 * O log como a tela o mostra: título e texto resolvidos no idioma de quem lê, com o nome da entidade
 * vindo da tela instalada HOJE. É a mesma conta para a trilha ao vivo e para a linha lida do arquivo
 * — a prova não pode aparecer escrita de outro jeito que o original.
 */
export const presentAuditLog = (
  t: TranslateFn,
  label: LabelFn,
  log: AuditLog,
  screens: ScreenDefinition[] = [],
): PresentedAuditLog => {
  const entity = entityLabel(t, label, log.entity, screens);
  return {
    log: {
      ...log,
      title: label(log.title, { ...log.titleParams, entity }),
      text: label(log.text, { ...log.textParams, entity }),
    },
    entityLabel: entity,
  };
};

const dateOf = (value: unknown): Date => new Date(typeof value === 'string' ? value : 0);

/** A linha do arquivo como log: os instantes, gravados em ISO, voltam a ser datas. */
export const archivedAuditLog = (log: Record<string, unknown>): AuditLog => ({
  ...(log as unknown as AuditLog),
  createdAt: dateOf(log.createdAt),
  expiresAt: dateOf(log.expiresAt),
});
