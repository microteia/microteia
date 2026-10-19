import type { PortalScreenLike } from '../schema/portal';
import type { PortalHomeSettings } from '../schema/portalExtensionPoints';

/** Uma tela do escritório como o portal a lê — com os rótulos, para o contexto que a casca recebe. */
export interface PortalScreen extends PortalScreenLike {
  titleSingular: string;
  titlePlural: string;
  icon: string;
  fields: Array<{
    key: string;
    label: string;
    type?: string;
    refEntity?: string | null;
    multi?: boolean;
    required?: boolean;
    defaultValue?: unknown;
    options?: Array<{ key: string; label: string }>;
  }>;
}

export interface PortalUserRecord {
  userId: string;
  email: string;
  displayName: string;
  subjectKeys: string[];
  /** O idioma de quem convidou — o do portal, quando ninguém escolheu outro. */
  locale?: string;
}

export interface PortalUserGrant {
  userId: string;
  email: string;
  displayName: string;
  tenantName: string;
  invitedBy: string;
  locale?: string;
}

export interface PortalProjection {
  collection: string;
  recordId: string;
  screenId: string;
  subjectKeys: string[];
  audience: string[];
  title: string;
  data: Record<string, unknown>;
  /** O rótulo do registro APONTADO por cada campo `reference` exposto — o id não diz nada a quem é de fora. */
  labels: Record<string, string>;
  /**
   * O registro-PAI no portal (`colecao/id`): o prestador de uma nota, a nota de um item. É por ele que
   * a casca mostra os filhos dentro do pai, em vez de soltos numa aba.
   */
  parentKeys: string[];
}

export interface PortalDocumentProjection {
  name: string;
  type: string | null;
  description: string | null;
  createdAt: unknown;
}

export interface SharedRecordDocument extends PortalDocumentProjection {
  id: string;
  url: string;
}

export interface ProjectionPage {
  items: Array<{ id: string; subjectKeys: string[]; audience: string[] }>;
  next: string | null;
}

export interface RecordPage {
  items: Array<{ id: string; data: Record<string, unknown> }>;
  next: string | null;
}

export interface IPortalRepository {
  /** O que o escritório configurou na home do portal — boas-vindas, menu e widgets. */
  getHomeSettings(tenantId: string): Promise<PortalHomeSettings>;
  /** Todas as telas do escritório, com a declaração `portal` de cada uma (ou nenhuma). */
  getScreens(tenantId: string, options?: { fresh?: boolean }): Promise<PortalScreen[]>;
  getRecord(tenantId: string, collection: string, recordId: string): Promise<Record<string, unknown> | undefined>;
  /** Os registros que apontam para `recordId` pelo campo — os dependentes que herdam o sujeito dele. */
  getRecordsReferencing(
    tenantId: string,
    collection: string,
    fieldKey: string,
    recordId: string,
    multi: boolean,
  ): Promise<Array<{ id: string; data: Record<string, unknown> }>>;
  listRecords(tenantId: string, collection: string, after: string | null, pageSize: number): Promise<RecordPage>;

  /** Quem é convidado de algum destes sujeitos. */
  audienceFor(tenantId: string, subjectKeys: string[]): Promise<string[]>;
  getProjection(tenantId: string, projectionId: string): Promise<PortalProjection | null>;
  writeProjection(tenantId: string, projectionId: string, projection: PortalProjection): Promise<void>;
  /** Apaga a projeção e os documentos projetados dela. */
  deleteProjection(tenantId: string, projectionId: string): Promise<void>;
  projectionsForSubject(tenantId: string, subjectKey: string, after: string | null, pageSize: number): Promise<ProjectionPage>;
  projectionsOfCollection(tenantId: string, collection: string, after: string | null, pageSize: number): Promise<ProjectionPage>;
  setAudiences(tenantId: string, changes: Array<{ projectionId: string; audience: string[] }>): Promise<void>;

  sharedDocuments(tenantId: string, collection: string, recordId: string): Promise<SharedRecordDocument[]>;
  getRecordDocument(
    tenantId: string,
    collection: string,
    recordId: string,
    documentId: string,
  ): Promise<(SharedRecordDocument & { portalShared: boolean }) | null>;
  writeDocumentProjection(
    tenantId: string,
    projectionId: string,
    documentId: string,
    projection: PortalDocumentProjection,
  ): Promise<void>;
  deleteDocumentProjection(tenantId: string, projectionId: string, documentId: string): Promise<void>;

  getPortalUser(tenantId: string, userId: string): Promise<PortalUserRecord | null>;
  listPortalUsers(tenantId: string): Promise<PortalUserRecord[]>;
  grantSubject(tenantId: string, grant: PortalUserGrant, subjectKey: string): Promise<void>;
  /** Tira o sujeito do convite; sem sujeito nenhum, o convite deixa de existir. */
  revokeSubject(tenantId: string, userId: string, subjectKey: string | null): Promise<void>;

  /** O arquivo que o convidado deixou na área de espera — `null` quando não está lá. */
  readStagedUpload(tenantId: string, userId: string, uploadId: string): Promise<{ data: Buffer; contentType: string } | null>;
  deleteStagedUpload(tenantId: string, userId: string, uploadId: string): Promise<void>;

  /** A marca gravada ANTES de a conta existir — é ela que diz ao bootstrap que não há escritório a criar. */
  markInvite(email: string, tenantId: string): Promise<void>;
  hasInvite(email: string): Promise<boolean>;
}

/** A conta de login de quem é convidado. Separada porque é outro serviço do Firebase. */
export interface IPortalAccountService {
  findUserIdByEmail(email: string): Promise<{ userId: string; displayName: string | null } | null>;
  createAccount(email: string): Promise<string>;
}
