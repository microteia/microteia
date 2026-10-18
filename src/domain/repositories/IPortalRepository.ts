import type {
  PortalContext,
  PortalDocument,
  PortalGuest,
  PortalMembership,
  PortalRecord,
} from '../entities/Portal';

export interface IPortalRepository {
  /** Os escritórios em que a pessoa é convidada. */
  listMemberships(userId: string): Promise<PortalMembership[]>;
  getContext(tenantId: string): Promise<PortalContext>;
  subscribeRecords(
    tenantId: string,
    userId: string,
    collection: string,
    onUpdate: (records: PortalRecord[]) => void,
    onError?: (error: Error) => void,
  ): () => void;
  getDocuments(tenantId: string, projectionId: string): Promise<PortalDocument[]>;
  getDocumentUrl(tenantId: string, projectionId: string, documentId: string): Promise<string>;

  /** Do lado do ESCRITÓRIO: quem é convidado, e de quê. */
  subscribeGuests(
    tenantId: string,
    onUpdate: (guests: PortalGuest[]) => void,
    onError?: (error: Error) => void,
  ): () => void;
  invite(tenantId: string, email: string, subjectKey: string): Promise<{ userId: string; created: boolean }>;
  revoke(tenantId: string, userId: string, subjectKey: string | null): Promise<void>;
}
