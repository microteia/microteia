import type {
  PortalContext,
  PortalDocument,
  PortalGuest,
  PortalLinkOption,
  PortalMembership,
  PortalRecord,
} from '../entities/Portal';

export interface IPortalRepository {
  /** Os escritórios em que a pessoa é convidada. */
  listMemberships(userId: string): Promise<PortalMembership[]>;
  /** `locale` é o do navegador — vale quando ninguém escolheu um idioma. */
  getContext(tenantId: string, locale: string): Promise<PortalContext>;
  subscribeRecords(
    tenantId: string,
    userId: string,
    collection: string,
    onUpdate: (records: PortalRecord[]) => void,
    onError?: (error: Error) => void,
  ): () => void;
  getDocuments(tenantId: string, projectionId: string): Promise<PortalDocument[]>;
  getDocumentUrl(tenantId: string, projectionId: string, documentId: string): Promise<string>;
  /** Os registros desta coleção que o convidado enxerga — a que um registro novo pode pertencer. */
  listLinkOptions(tenantId: string, userId: string, collection: string): Promise<PortalLinkOption[]>;
  /** Cria um registro pelo portal. A recusa de validação chega já traduzida no `message`. */
  submit(input: {
    tenantId: string;
    collection: string;
    linkRecordId: string;
    data: Record<string, unknown>;
    locale: string;
  }): Promise<{ id: string }>;

  /** Do lado do ESCRITÓRIO: quem é convidado, e de quê. */
  subscribeGuests(
    tenantId: string,
    onUpdate: (guests: PortalGuest[]) => void,
    onError?: (error: Error) => void,
  ): () => void;
  /** `locale` é o de quem convida: vira o idioma do portal do convidado enquanto ninguém escolher outro. */
  invite(tenantId: string, email: string, subjectKey: string, locale: string): Promise<{ userId: string; created: boolean }>;
  revoke(tenantId: string, userId: string, subjectKey: string | null): Promise<void>;
}
