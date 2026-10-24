import type {
  PortalContext,
  PortalDocument,
  PortalGuest,
  PortalLinkOption,
  PortalMembership,
  PortalRecord,
} from '../entities/Portal';
import type { PortalHomeSettings } from '../schema/portalExtensionPoints';
import type { PortalProfile } from '../schema/portal';
import type { PortalReprojectionState } from '../schema/portalReprojection';

export interface IPortalRepository {
  /** Os escritórios em que a pessoa é convidada. */
  listMemberships(userId: string): Promise<PortalMembership[]>;
  /** `locale` é o do navegador — vale quando ninguém escolheu um idioma. */
  getContext(tenantId: string, locale: string): Promise<PortalContext>;
  /** O convidado grava o PRÓPRIO perfil neste escritório — as rules deixam mudar só ele. */
  saveProfile(tenantId: string, userId: string, profile: PortalProfile): Promise<void>;
  subscribeRecords(
    tenantId: string,
    userId: string,
    collection: string,
    onUpdate: (records: PortalRecord[]) => void,
    onError?: (error: Error) => void,
  ): () => void;
  /**
   * Os FILHOS de um registro (`parentKey` = `colecao/id`), os mais recentes primeiro, até `max` — é o
   * servidor que limita, e não a tela: a empresa de dez mil notas entrega as 15 de cima.
   */
  subscribeChildren(
    tenantId: string,
    userId: string,
    collection: string,
    parentKey: string,
    max: number,
    onUpdate: (records: PortalRecord[]) => void,
    onError?: (error: Error) => void,
  ): () => void;
  getDocuments(tenantId: string, projectionId: string): Promise<PortalDocument[]>;
  getDocumentUrl(tenantId: string, projectionId: string, documentId: string): Promise<string>;
  /**
   * Anexa um documento pelo portal: o arquivo vai para a área de espera do convidado, e a callable o
   * confere e o leva ao registro. Não existe o gesto inverso.
   */
  uploadDocument(input: {
    tenantId: string;
    userId: string;
    collection: string;
    recordId: string;
    file: File;
    type: string;
  }): Promise<{ id: string }>;
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
  /** Altera um registro pelo portal — só os campos que a tela deixa. A recusa chega já traduzida. */
  update(input: {
    tenantId: string;
    collection: string;
    recordId: string;
    data: Record<string, unknown>;
    locale: string;
  }): Promise<{ id: string }>;

  /** Do lado do ESCRITÓRIO: a home do portal — boas-vindas, ordem do menu e dos widgets. */
  getHomeSettings(tenantId: string): Promise<PortalHomeSettings>;
  saveHomeSettings(tenantId: string, settings: PortalHomeSettings): Promise<void>;

  /** Do lado do ESCRITÓRIO: quem é convidado, e de quê. */
  subscribeGuests(
    tenantId: string,
    onUpdate: (guests: PortalGuest[]) => void,
    onError?: (error: Error) => void,
  ): () => void;
  /**
   * Do lado do ESCRITÓRIO: as passadas que atualizam o portal depois que uma declaração mudou, por
   * coleção. Só quem tem `portal.manage` as lê; a leitura recusada entrega o mapa vazio.
   */
  subscribeReprojections(
    tenantId: string,
    onUpdate: (states: Map<string, PortalReprojectionState>) => void,
  ): () => void;
  /** `locale` é o de quem convida: vira o idioma do portal do convidado enquanto ninguém escolher outro. */
  invite(tenantId: string, email: string, subjectKey: string, locale: string): Promise<{ userId: string; created: boolean }>;
  revoke(tenantId: string, userId: string, subjectKey: string | null): Promise<void>;
}
