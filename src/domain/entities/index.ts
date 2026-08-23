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

// ─── RBAC global ─────────────────────────────────────────────────────────────

/**
 * Papel GLOBAL. `SYSTEM` é o único acesso irrestrito do produto — vê e administra todos os
 * escritórios, e só outro `SYSTEM` o concede. Ele NÃO é um perfil de acesso: perfil é dado do
 * escritório, e não existiria escritório nenhum antes do primeiro `SYSTEM`.
 */
export type UserRole = 'SYSTEM' | 'USER';

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

/**
 * O que se pode GRAVAR no escritório: os campos que o kernel declara mais os que o escritório
 * acrescentou pelo Form Design.
 *
 * O documento do escritório deixou de ter forma fechada quando a tela dele virou plugin: a entidade
 * `tenant` do registro é editável no Form Design como qualquer outra, e um campo criado lá grava na
 * RAIZ do documento — a mesma convenção das telas fixas, sem envelope. O tipo diz isso em vez de
 * fingir que a forma continua fechada.
 *
 * Ler continua tipado: `Tenant` segue fechado, e quem precisa de um campo acrescentado o lê pelo
 * nome, como se lê qualquer campo customizado.
 */
export type TenantUpdate =
  Partial<Omit<Tenant, 'id' | 'ownerId' | 'createdAt'>> & Record<string, unknown>;

export interface TenantMember {
  userId: string;
  tenantId: string;
  /** Os perfis de acesso do membro NESTE escritório. Ver `Role`. */
  roleIds: string[];
  /**
   * As permissões EFETIVAS já resolvidas — cache, não fonte de verdade.
   *
   * Existe para as Security Rules, que não sabem resolver dependência e já leem este documento: um
   * campo aqui custa zero leituras a mais que o `role` que elas liam antes. Quem o escreve é
   * exclusivamente o Admin SDK (`materializeMemberPermissions`); o cliente tem escrita negada nele,
   * e recalcula o conjunto por conta própria em vez de confiar no que está gravado.
   *
   * O curinga `*` aparece para o DONO do escritório, e só para ele: é o que impede que um escritório
   * recém-criado nasça sem ninguém capaz de configurá-lo.
   */
  permissions: string[];
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

export type { Role, RoleInput } from './Role';
