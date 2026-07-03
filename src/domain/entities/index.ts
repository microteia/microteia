// ─── Core user ───────────────────────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  displayName: string;
  photoURL: string | null;
}

export type ThemeMode = 'dark' | 'light' | 'claude' | 'teams' | 'bruma' | 'kindle' | 'curatino';

// ─── RBAC global ─────────────────────────────────────────────────────────────

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
  apiKey: string;
  model: string;
  temperature: number;
  maxTokens: number;
  isDefault: boolean;
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
}

// ─── Persons (Pessoas) ────────────────────────────────────────────────────────

export type PersonType = 'Pessoa Física' | 'Pessoa Jurídica';
export type PersonStatus = 'Ativo' | 'Inativo';

export type PersonLookupKind = 'types' | 'occupations' | 'nationalities' | 'maritalStatuses' | 'cities' | 'relationships';

export interface PersonLookupConfig {
  key: string;
  label: string;
  color?: string;
  isStatic?: boolean;
}

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
}

// ─── Cases (Processos) ────────────────────────────────────────────────────────

export type CaseStatus = 'Em Andamento' | 'Arquivado' | 'Ganho' | 'Perdido' | 'Acordo' | 'Suspenso';
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

export interface CaseAreaConfig {
  key: string;
  label: string;
  isStatic?: boolean;
}

export interface CasePhaseConfig {
  key: string;
  label: string;
  color?: string;
  isStatic?: boolean;
}

export interface CaseStatusConfig {
  key: string;
  label: string;
  color: string;
  isStatic?: boolean;
}

export interface CaseInstanceConfig {
  key: string;
  label: string;
  color?: string;
  isStatic?: boolean;
}

export interface CaseActionTypeConfig {
  key: string;
  label: string;
  isStatic?: boolean;
}

export interface CaseCourtConfig {
  key: string;
  label: string;
  isStatic?: boolean;
}

export interface CaseDistrictConfig {
  key: string;
  label: string;
  isStatic?: boolean;
}

export interface CaseJudgeConfig {
  key: string;
  label: string;
  isStatic?: boolean;
}

export interface DocumentTypeConfig {
  key: string;
  label: string;
  isStatic?: boolean;
}

export interface CaseParty {
  name: string;
  cpfCnpj?: string;
  role?: string;
  counsel?: string;
  email?: string;
  phone?: string;
}

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
  responsibleLawyerId: string;
  responsibleLawyerName: string;
  contractId?: string | null;
  contractNumber?: string | null;
  activePoleIds?: string[];
  passivePoleIds?: string[];
  opposingParties?: CaseParty[];
  filedAt?: Date | null;
  causeValue?: number | null;
  notes?: string | null;
  tags?: string[];
  tagIds?: string[];
  createdAt: Date;
  createdBy: string;
  updatedAt: Date;
  updatedBy?: string;
  updatedByName?: string;
  updatedByPhotoURL?: string;
}

// ─── Deadlines (Prazos) ───────────────────────────────────────────────────────

export type DeadlineStatus = 'Pendente' | 'Concluído' | 'Vencido' | 'Cancelado';
export type DeadlinePriority = 'Baixa' | 'Média' | 'Alta' | 'Crítica';

export interface DeadlineTypeConfig {
  key: string;
  label: string;
  isStatic?: boolean;
}

export interface Deadline {
  id: string;
  tenantId: string;
  caseId: string;
  caseNumber: string;
  caseTitle: string;
  personName: string;
  description?: string | null;
  dueDate: Date;
  type: string;
  priority: DeadlinePriority;
  status: DeadlineStatus;
  responsibleLawyerId?: string | null;
  responsibleLawyerName?: string | null;
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
}

// ─── Financials (Financeiro) ──────────────────────────────────────────────────

export type FinancialType = 'Receita' | 'Despesa';
export type FinancialStatus = 'Aberto' | 'Pago' | 'Cancelado';
export type PaymentMethod = 'PIX' | 'Transferência' | 'Dinheiro' | 'Cartão' | 'Cheque' | 'Outro';

export interface Financial {
  id: string;
  tenantId: string;
  caseId?: string | null;
  caseNumber?: string | null;
  personId?: string | null;
  personName?: string | null;
  contractId?: string | null;
  contractNumber?: string | null;
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
}

// ─── Financial Lookups ────────────────────────────────────────────────────────

export type FinancialLookupKind = 'categories' | 'statuses';

export interface FinancialLookupConfig {
  key: string;
  label: string;
  color?: string;
  isStatic?: boolean;
}

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

export interface ContractLookupConfig {
  key: string;
  label: string;
  color?: string;
  isStatic?: boolean;
}

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

export interface NewsCategoryConfig {
  key: string;
  label: string;
  isStatic?: boolean;
}

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

// ─── Case Lookups ─────────────────────────────────────────────────────────────

export type CaseLookupKind =
  | 'areas'
  | 'phases'
  | 'statuses'
  | 'instances'
  | 'actionTypes'
  | 'courts'
  | 'districts'
  | 'judges';

export interface CaseLookupItem {
  id: string;
  tenantId: string;
  name: string;
  createdAt: Date;
  createdBy: string;
}

// ─── Push ─────────────────────────────────────────────────────────────────────

export type { Push, PushMovement, PushStatus, PushInteraction } from './Push';

// ─── Audit Logs ───────────────────────────────────────────────────────────────

export type { AuditLog, AuditAction, AuditSeverity, AuditType } from './AuditLog';
