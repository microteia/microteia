// ─── Core user ───────────────────────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  displayName: string;
  photoURL: string | null;
}

// ─── Autoria de exclusão ──────────────────────────────────────────────────────

export interface DeletionActor {
  uid: string;
  name: string;
  photoURL: string;
}

export type ThemeMode = 'dark' | 'light' | 'claude' | 'teams' | 'bruma' | 'kindle' | 'microteia' | 'themis' | 'themisDark';

// ─── RBAC global ─────────────────────────────────────────────────────────────

export type UserRole = 'SYSTEM' | 'USER' | 'SUPPORT';

export interface AppUser {
  id: string;
  email: string;
  displayName: string;
  photoURL: string | null;
  role: UserRole;
  createdAt: Date;
}

// ─── UserProfile ──────────────────────────────────────────────────────────────

/**
 * O CÓDIGO gravado, não o rótulo: a tela sempre gravou 'M'/'F'/'N' e o tipo dizia outra coisa. O nome
 * de cada código vem do catálogo (`profile.gender.*`), como todo texto que o usuário lê.
 */
export type Gender = 'M' | 'F' | 'N';

export interface UserProfile {
  id: string;
  userId: string;
  fullName?: string | null;
  nickname?: string | null;
  nicknameSetAt?: Date | null;
  phone?: string | null;
  gender?: Gender | null;
  birthDate?: Date | null;
  photoURL?: string | null;
}

export type NicknameCheckReason = 'format' | 'blocked' | 'taken';

export interface NicknameCheckResult {
  available: boolean;
  reason?: NicknameCheckReason;
}

// ─── AI Connections ───────────────────────────────────────────────────────────

export type AIProvider = 'openai' | 'anthropic' | 'google' | 'mistral' | 'cohere' | 'ollama' | 'other';

export interface AIConnection {
  id: string;
  tenantId: string;
  name: string;
  provider: AIProvider;
  model: string;
  temperature: number;
  maxTokens: number;
  isDefault: boolean;
  hasApiKey: boolean;
  createdAt: Date;
}

// ─── Tenant (Escritório) ──────────────────────────────────────────────────────

export type TenantRole = 'admin' | 'lawyer' | 'secretary' | 'user';

export type TenantPlan = 'solo' | 'office' | 'professional' | 'enterprise';

export const TENANT_PLANS: TenantPlan[] = ['solo', 'office', 'professional', 'enterprise'];

export const TENANT_PLAN_LABELS: Record<TenantPlan, string> = {
  solo: 'Solo',
  office: '@core.admin/plan.office',
  professional: 'Professional',
  enterprise: 'Enterprise',
};

export const TENANT_PLAN_MEMBER_LIMITS: Record<TenantPlan, number> = {
  solo: 1,
  office: 5,
  professional: 15,
  enterprise: 100,
};

export interface Tenant {
  id: string;
  name: string;
  ownerId: string;
  cnpj?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  logoURL?: string | null;
  plan: TenantPlan;
  memberLimit: number | null;
  memberCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface TenantMember {
  userId: string;
  tenantId: string;
  role: TenantRole;
  displayName: string;
  email: string;
  photoURL: string | null;
  addedAt: Date;
  addedBy: string;
  updatedAt?: Date;
  updatedBy?: string;
  deletedBy?: string;
  deletedByName?: string;
  deletedByPhotoURL?: string;
}

// ─── Calendar events ──────────────────────────────────────────────────────────

export type CalendarEventType = 'deadline' | 'hearing' | 'meeting' | 'other';

export interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  resource: {
    type: CalendarEventType;
    priority?: string;
    caseNumber?: string;
    personName?: string;
    status?: string;
    deadlineId?: string;
  };
}

// ─── Saved Filters ────────────────────────────────────────────────────────────

export interface SavedFilterToken {
  key: string;
  values: string[];
}

export interface SavedFilter {
  id: string;
  userId: string;
  screenKey: string;
  name: string;
  tokens: SavedFilterToken[];
  createdAt: Date;
}

// ─── Text Annotations ────────────────────────────────────────────────────────

export type AnnotationContentType = 'news' | 'case';
export type AnnotationFormatType = 'bold' | 'italic' | 'underline' | 'strikethrough';
export type AnnotationHighlightColor = 'yellow' | 'green' | 'pink' | 'blue' | 'orange';

export interface AnnotationRange {
  id: string;
  startOffset: number;
  endOffset: number;
  formatType?: AnnotationFormatType;
  highlightColor?: AnnotationHighlightColor;
}

export interface TextAnnotation {
  id: string;
  userId: string;
  contentType: AnnotationContentType;
  contentId: string;
  fieldName: string;
  ranges: AnnotationRange[];
  updatedAt: Date;
}

// ─── Custom Screens (Telas Dinâmicas) ────────────────────────────────────────

export type {
  CustomFieldType,
  CustomFieldMask,
  CustomFieldValue,
  CustomFieldOption,
  FieldDefinition,
  FieldOrigin,
  ScreenDefinition,
  ScreenListAction,
} from './entitySchemas';

export type {
  ActionDefinition,
  ActionLocalCommand,
  ActionOutcome,
  ActionStatus,
  ActionStatusCode,
} from './Action';

// ─── Etiquetas ────────────────────────────────────────────────────────────────

/**
 * Uma etiqueta. Mora em `tenants/{tenantId}/{colecao}/{id}` — a MESMA forma para a do kernel
 * (`caseTags`) e para a de uma tela do Form Design ou de extensão. Qual coleção uma tela usa está
 * em `ScreenDefinition.tagCollection`, e por isso duas telas podem compartilhar as mesmas etiquetas.
 */
export interface Tag {
  id: string;
  tenantId: string;
  name: string;
  color: string;
  createdAt: Date;
  createdBy: string;
  createdByName?: string;
  createdByPhotoURL?: string;
  updatedBy?: string;
  updatedByName?: string;
  updatedByPhotoURL?: string;
  deletedBy?: string;
  deletedByName?: string;
  deletedByPhotoURL?: string;
}

/**
 * A declaração de uma coleção de etiquetas criada no tenant — gêmea de `LookupDefinition`, e pelo
 * mesmo motivo: é o `exists()` que as Security Rules consultam para autorizar a escrita numa
 * coleção cujo nome só existe em runtime.
 */
export interface TagDefinition {
  collection: string;
  label: string;
  ownerPluginId?: string | null;
  ownerPluginIds?: string[];
  createdAt: Date;
  createdBy: string;
}

// ─── Listas de opções ─────────────────────────────────────────────────────────

/**
 * Uma opção de lista. Mora em `tenants/{tenantId}/{colecao}/{id}` — a MESMA forma para a lista do
 * kernel (`caseCourts`) e para a criada no Form Design ou por uma extensão. `isStatic` marca a
 * opção que vem declarada em código e por isso não é excluível.
 */
export interface LookupOption {
  key: string;
  label: string;
  color?: string;
  isStatic?: boolean;
}

/**
 * A declaração de uma lista criada no tenant — o gêmeo, do lado do Firestore, do `LOOKUP_REGISTRY`
 * de código. Vive em `tenants/{tenantId}/lookupDefinitions/{colecao}`, e o id do documento É o nome
 * da coleção onde as opções ficam.
 *
 * Existe por dois motivos: dá nome e dono à lista na interface, e é o `exists()` que as Security
 * Rules consultam para autorizar a escrita numa coleção que só existe em runtime.
 */
export interface LookupDefinition {
  collection: string;
  label: string;
  /**
   * Sem `origin`, ao contrário de `ScreenDefinition`: aqui ele não teria o que responder. A lista do
   * kernel não tem documento — é declarada em código —, e a de extensão já se identifica por
   * `ownerPluginIds`, que é o que a desinstalação consulta.
   */
  ownerPluginId?: string | null;
  ownerPluginIds?: string[];
  createdAt: Date;
  createdBy: string;
}

// ─── Registros de qualquer entidade ───────────────────────────────────────────

export type {
  EntityRecord,
  EntityRecordValues,
  RecordDocument,
  RecordIdentity,
  RecordNote,
} from './EntityRecord';



// ─── Audit Logs ───────────────────────────────────────────────────────────────

export type { AuditLog, AuditAction, AuditSeverity, AuditType, AuditLogReadCursor } from './AuditLog';
