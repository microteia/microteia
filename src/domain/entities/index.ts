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

export type Gender = 'Masculino' | 'Feminino' | 'Não Informado';

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

// ─── Gmail Connections ────────────────────────────────────────────────────────

export interface GmailConnection {
  id: string;
  tenantId: string;
  email: string;
  scopes: string[];
  authorizedBy: string;
  authorizedByName: string;
  authorizedAt: Date;
  historyId?: string;
  expiration?: string;
}

export interface GmailToken {
  id: string;
  connectionId: string;
  tenantId: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}

// ─── Tenant (Escritório) ──────────────────────────────────────────────────────

export type TenantRole = 'admin' | 'lawyer' | 'secretary' | 'user';

export type TenantPlan = 'solo' | 'office' | 'professional' | 'enterprise';

export const TENANT_PLANS: TenantPlan[] = ['solo', 'office', 'professional', 'enterprise'];

export const TENANT_PLAN_LABELS: Record<TenantPlan, string> = {
  solo: 'Solo',
  office: 'Escritório',
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
  allowedSenders?: string[];
  allowedSubjects?: string[];
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

// ─── Persons (Pessoas) ────────────────────────────────────────────────────────

export type PersonType = 'Pessoa Física' | 'Pessoa Jurídica';
export type PersonStatus = 'Ativo' | 'Inativo';

export interface PersonAddress {
  street?: string;
  number?: string;
  complement?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  zipCode?: string;
}

export interface Person {
  id: string;
  tenantId: string;
  type: PersonType;
  name: string;
  cpf?: string | null;
  cnpj?: string | null;
  email?: string | null;
  phone?: string | null;
  secondaryPhone?: string | null;
  address?: PersonAddress | null;
  occupation?: string | null;
  nationality?: string | null;
  maritalStatus?: string | null;
  relationship?: string | null;
  birthDate?: Date | null;
  gender?: Gender | null;
  notes?: string | null;
  tagIds?: string[];
  status: PersonStatus;
  createdAt: Date;
  createdBy: string;
  updatedAt: Date;
  updatedBy?: string;
  updatedByName?: string;
  updatedByPhotoURL?: string;
  deletedBy?: string;
  deletedByName?: string;
  deletedByPhotoURL?: string;
}

// ─── Person Tags ──────────────────────────────────────────────────────────────

export interface PersonTag {
  id: string;
  tenantId: string;
  name: string;
  color: string;
  createdAt: Date;
  createdBy: string;
  updatedBy?: string;
  updatedByName?: string;
  updatedByPhotoURL?: string;
  deletedBy?: string;
  deletedByName?: string;
  deletedByPhotoURL?: string;
}

// ─── Person Notes ─────────────────────────────────────────────────────────────

export interface PersonNote {
  id: string;
  personId: string;
  tenantId: string;
  title: string;
  text: string;
  createdBy: string;
  createdByName: string;
  createdByPhotoUrl?: string;
  createdAt: Date;
  deletedBy?: string;
  deletedByName?: string;
  deletedByPhotoURL?: string;
}

// ─── Person Documents ─────────────────────────────────────────────────────────

export interface PersonDocument {
  id: string;
  personId: string;
  tenantId: string;
  name: string;
  type?: string;
  description?: string;
  url: string;
  storagePath: string;
  createdBy: string;
  createdByName: string;
  createdByPhotoUrl?: string;
  createdAt: Date;
  deletedBy?: string;
  deletedByName?: string;
  deletedByPhotoURL?: string;
}

// ─── Case Tags ────────────────────────────────────────────────────────────────

export interface CaseTag {
  id: string;
  tenantId: string;
  name: string;
  color: string;
  createdAt: Date;
  createdBy: string;
  updatedBy?: string;
  updatedByName?: string;
  updatedByPhotoURL?: string;
  deletedBy?: string;
  deletedByName?: string;
  deletedByPhotoURL?: string;
}

// ─── Case Notes ───────────────────────────────────────────────────────────────

export interface CaseNote {
  id: string;
  caseId: string;
  tenantId: string;
  title: string;
  text: string;
  createdBy: string;
  createdByName: string;
  createdByPhotoUrl?: string;
  createdAt: Date;
  deletedBy?: string;
  deletedByName?: string;
  deletedByPhotoURL?: string;
}

// ─── Case Documents ───────────────────────────────────────────────────────────

export interface CaseDocument {
  id: string;
  caseId: string;
  tenantId: string;
  name: string;
  type?: string;
  description?: string;
  url: string;
  storagePath: string;
  createdBy: string;
  createdByName: string;
  createdByPhotoUrl?: string;
  createdAt: Date;
  deletedBy?: string;
  deletedByName?: string;
  deletedByPhotoURL?: string;
}

// ─── Cases (Processos) ────────────────────────────────────────────────────────

export type CaseArea =
  | 'Cível'
  | 'Criminal'
  | 'Trabalhista'
  | 'Tributário'
  | 'Família'
  | 'Consumidor'
  | 'Administrativo'
  | 'Constitucional'
  | 'Ambiental'
  | 'Imobiliário'
  | 'Empresarial'
  | 'Digital'
  | 'Outros';

export type CasePhase =
  | 'Fase Inicial'
  | 'Instrução'
  | 'Sentença'
  | 'Recurso'
  | 'Execução'
  | 'Arquivado';

export type CaseInstance =
  | '1º Grau'
  | '2º Grau'
  | 'Turma Recursal'
  | 'STJ'
  | 'STF'
  | 'TST'
  | 'TSE';

export interface CaseParty {
  name: string;
  cpfCnpj?: string;
  role?: string;
  counsel?: string;
  email?: string;
  phone?: string;
}

export type CaseStatus = 'Em Andamento' | 'Arquivado' | 'Ganho' | 'Perdido' | 'Acordo' | 'Suspenso';

export interface Case {
  id: string;
  tenantId: string;
  caseNumber: string;
  title: string;
  area: CaseArea;
  type?: string[];
  court?: string | null;
  courtDistrict?: string | null;
  judge?: string | null;
  instance?: CaseInstance;
  phase: CasePhase;
  status: CaseStatus;
  responsibleLawyerId?: string | null;
  contractId?: string | null;
  activePoleIds?: string[];
  passivePoleIds?: string[];
  opposingParties?: CaseParty[];
  filedAt?: Date | null;
  causeValue?: number | null;
  notes?: string | null;
  tagIds?: string[];
  createdAt: Date;
  createdBy: string;
  updatedAt: Date;
  updatedBy?: string;
  updatedByName?: string;
  updatedByPhotoURL?: string;
  deletedBy?: string;
  deletedByName?: string;
  deletedByPhotoURL?: string;
}

// ─── Deadlines (Prazos) ───────────────────────────────────────────────────────

export type DeadlineStatus = 'Pendente' | 'Concluído' | 'Vencido' | 'Cancelado';
export type DeadlinePriority = 'Baixa' | 'Média' | 'Alta' | 'Crítica';

export interface Deadline {
  id: string;
  tenantId: string;
  caseId: string;
  description?: string | null;
  dueDate: Date;
  type: string;
  priority: DeadlinePriority;
  status: DeadlineStatus;
  responsibleLawyerId?: string | null;
  completedAt?: Date | null;
  completedBy?: string | null;
  notes?: string | null;
  pushIds?: string[];
  createdAt: Date;
  createdBy: string;
  updatedAt: Date;
  updatedBy?: string;
  updatedByName?: string;
  updatedByPhotoURL?: string;
  deletedBy?: string;
  deletedByName?: string;
  deletedByPhotoURL?: string;
}

// ─── Financials (Financeiro) ──────────────────────────────────────────────────

export type FinancialType = 'Receita' | 'Despesa';
export type FinancialStatus = 'Aberto' | 'Pago' | 'Cancelado';
export type PaymentMethod = 'PIX' | 'Transferência' | 'Dinheiro' | 'Cartão' | 'Cheque' | 'Outro';

export interface Financial {
  id: string;
  tenantId: string;
  caseId?: string | null;
  personId?: string | null;
  contractId?: string | null;
  type: FinancialType;
  category: string;
  costCenter?: string | null;
  amount: number;
  dueDate: Date;
  paymentDate?: Date | null;
  cancelDate?: Date | null;
  status: string;
  paymentMethod?: PaymentMethod | null;
  invoiceNumber?: string | null;
  notes?: string | null;
  tagIds?: string[];
  createdAt: Date;
  createdBy: string;
  updatedAt: Date;
  updatedBy?: string;
  updatedByName?: string;
  updatedByPhotoURL?: string;
  deletedBy?: string;
  deletedByName?: string;
  deletedByPhotoURL?: string;
}

// ─── Financial Tags ───────────────────────────────────────────────────────────

export interface FinancialTag {
  id: string;
  tenantId: string;
  name: string;
  color: string;
  createdAt: Date;
  createdBy: string;
  updatedBy?: string;
  updatedByName?: string;
  updatedByPhotoURL?: string;
  deletedBy?: string;
  deletedByName?: string;
  deletedByPhotoURL?: string;
}

// ─── Financial Lookups ────────────────────────────────────────────────────────

// ─── Financial Documents ──────────────────────────────────────────────────────

export interface FinancialDocument {
  id: string;
  financialId: string;
  tenantId: string;
  name: string;
  type?: string;
  description?: string;
  url: string;
  storagePath: string;
  createdBy: string;
  createdByName: string;
  createdByPhotoUrl?: string;
  createdAt: Date;
  deletedBy?: string;
  deletedByName?: string;
  deletedByPhotoURL?: string;
}

// ─── Contract Tags ────────────────────────────────────────────────────────────

export interface ContractTag {
  id: string;
  tenantId: string;
  name: string;
  color: string;
  createdAt: Date;
  createdBy: string;
  updatedBy?: string;
  updatedByName?: string;
  updatedByPhotoURL?: string;
  deletedBy?: string;
  deletedByName?: string;
  deletedByPhotoURL?: string;
}

// ─── Contract Notes ───────────────────────────────────────────────────────────

export interface ContractNote {
  id: string;
  contractId: string;
  tenantId: string;
  title: string;
  text: string;
  createdBy: string;
  createdByName: string;
  createdByPhotoUrl?: string;
  createdAt: Date;
  deletedBy?: string;
  deletedByName?: string;
  deletedByPhotoURL?: string;
}

// ─── Contract Documents ───────────────────────────────────────────────────────

export interface ContractDocument {
  id: string;
  contractId: string;
  tenantId: string;
  name: string;
  type?: string;
  description?: string;
  url: string;
  storagePath: string;
  createdBy: string;
  createdByName: string;
  createdByPhotoUrl?: string;
  createdAt: Date;
  deletedBy?: string;
  deletedByName?: string;
  deletedByPhotoURL?: string;
}

// ─── Contract Lookups ─────────────────────────────────────────────────────────

export type ContractLookupKind =
  | 'types'
  | 'categories'
  | 'statuses'
  | 'objects'
  | 'adjustmentIndexes'
  | 'adjustmentPeriodicities'
  | 'currencies'
  | 'paymentMethods'
  | 'banks'
  | 'costCenters';

// ─── Contracts (Contratos) ────────────────────────────────────────────────────

export interface Contract {
  id: string;
  tenantId: string;
  number: string;
  title: string;
  type: string;
  category: string;
  status: string;
  object?: string | null;
  contractorIds: string[];
  contracteeIds: string[];
  witnessIds: string[];
  contractorLawyerIds: string[];
  contracteeLawyerIds: string[];
  clientId?: string | null;
  responsibleId?: string | null;
  draftedAt?: Date | null;
  signedAt?: Date | null;
  effectiveStart?: Date | null;
  effectiveEnd?: Date | null;
  autoRenewal: boolean;
  renewalDate?: Date | null;
  terminationDate?: Date | null;
  initialValue?: number | null;
  monthlyValue?: number | null;
  totalValue?: number | null;
  adjustmentIndex?: string | null;
  adjustmentPeriodicity?: string | null;
  currency?: string | null;
  paymentMethod?: string | null;
  dueDay?: number | null;
  installments?: number | null;
  bank?: string | null;
  bankAccount?: string | null;
  pixKey?: string | null;
  costCenter?: string | null;
  tagIds?: string[];
  createdAt: Date;
  createdBy: string;
  updatedAt: Date;
  updatedBy?: string;
  updatedByName?: string;
  updatedByPhotoURL?: string;
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
    priority?: DeadlinePriority;
    caseNumber?: string;
    personName?: string;
    status?: DeadlineStatus;
    deadlineId?: string;
  };
}

// ─── News (Notícias) ──────────────────────────────────────────────────────────

export interface News {
  id: string;
  userId: string;
  createdBy: string;
  // null = notícia do Sistema (criada pelo ADMIN global, visível a todos)
  // string = tenantId, notícia do escritório (visível apenas a membros deste tenant)
  tenantId: string | null;
  title: string;
  summary: string;
  content?: string;
  category: string;
  sourceURL?: string;
  imageURL?: string;
  likeCount: number;
  likedBy: string[];
  viewCount: number;
  commentCount: number;
  authorName?: string;
  authorPhotoURL?: string | null;
  editedAt?: Date;
  editedByName?: string;
  createdAt: Date;
  updatedAt: Date;
  deletedBy?: string;
  deletedByName?: string;
  deletedByPhotoURL?: string;
}

export interface NewsInteraction {
  id: string;
  userId: string;
  newsId: string;
  isRead: boolean;
  savedForLater: boolean;
  readAt?: Date;
  savedAt?: Date;
  updatedAt: Date;
}

export interface NewsTag {
  id: string;
  userId: string;
  name: string;
  color: string;
  createdAt: Date;
  deletedBy?: string;
  deletedByName?: string;
  deletedByPhotoURL?: string;
}

export interface NewsTagLink {
  id: string;
  userId: string;
  newsId: string;
  tagIds: string[];
}

export interface NewsComment {
  id: string;
  userId: string;
  newsId: string;
  content: string;
  authorName: string;
  authorPhotoURL: string | null;
  createdAt: Date;
  editedAt?: Date;
  editedByName?: string;
  likeCount: number;
  likedBy: string[];
  deletedBy?: string;
  deletedByName?: string;
  deletedByPhotoURL?: string;
}

export interface NewsDocument {
  id: string;
  newsId: string;
  name: string;
  type?: string;
  description?: string;
  url: string;
  storagePath: string;
  createdBy: string;
  createdByName: string;
  createdByPhotoUrl?: string;
  createdAt: Date;
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

// ─── Push ─────────────────────────────────────────────────────────────────────

export type { Push, PushMovement, PushStatus, PushInteraction } from './Push';

// ─── Audit Logs ───────────────────────────────────────────────────────────────

export type { AuditLog, AuditAction, AuditSeverity, AuditType, AuditLogReadCursor } from './AuditLog';
