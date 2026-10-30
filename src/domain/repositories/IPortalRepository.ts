import type {
  PortalContext,
  PortalDocument,
  PortalGuest,
  PortalIdentityInvite,
  PortalLinkOption,
  PortalMembership,
  PortalActionOutcome,
  PortalRecord,
  PortalRecordAction,
  PortalSignInSettingsView,
} from '../entities/Portal';
import type { PortalRequiredClaim, PortalSignInOptions, PortalSignInSettings } from '../schema/portalIdentity';
import type { PortalHomeSettings } from '../schema/portalExtensionPoints';
import type { PortalReprojectionState } from '../schema/portalReprojection';

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
   * Avisa o servidor de que o convidado abriu este registro — só para a tela que declara
   * `portal.trackViews`. A leitura da projeção é direta, e o servidor não a vê de outro jeito.
   */
  recordView(tenantId: string, projectionId: string): Promise<void>;
  /** Os botões do registro aberto (`portal.actions`), para este convidado e agora. */
  listRecordActions(tenantId: string, projectionId: string, locale: string): Promise<PortalRecordAction[]>;
  /** Dispara uma ação do escritório no registro aberto — o servidor confere tudo de novo. */
  runRecordAction(tenantId: string, projectionId: string, actionId: string, locale: string): Promise<PortalActionOutcome>;
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
  /**
   * `locale` é o de quem convida: vira o idioma do portal do convidado enquanto ninguém escolher outro.
   * Com `requiredClaim`, o convite é por IDENTIDADE: não abre conta pelo e-mail, e `inviteId` volta.
   */
  invite(
    tenantId: string,
    email: string,
    subjectKey: string,
    locale: string,
    requiredClaim?: PortalRequiredClaim,
  ): Promise<{ userId: string; created: boolean; inviteId?: string }>;
  /** Do convidado (`userId`) ou do convite por identidade (`inviteId`); sem sujeito, tudo. */
  revoke(tenantId: string, guest: { userId: string } | { inviteId: string }, subjectKey: string | null): Promise<void>;
  /** Do lado do ESCRITÓRIO: os convites por identidade, aceitos ou não. */
  subscribeIdentityInvites(
    tenantId: string,
    onUpdate: (invites: PortalIdentityInvite[]) => void,
    onError?: (error: Error) => void,
  ): () => void;
  getSignInSettings(tenantId: string): Promise<PortalSignInSettingsView>;
  /** `secrets`: por provedor, o segredo novo, `null` para apagar; ausente, mantém. */
  saveSignInSettings(
    tenantId: string,
    settings: PortalSignInSettings,
    secrets: Record<string, string | null>,
  ): Promise<PortalSignInSettingsView>;

  /** Antes de haver sessão: os métodos de entrada do portal de um escritório. */
  getSignInOptions(tenantId: string): Promise<PortalSignInOptions>;
  /** A ida ao provedor: o endereço para onde mandar a pessoa, e o `state` que a volta tem de trazer. */
  startSignIn(input: {
    tenantId: string;
    providerId: string;
    redirectUri: string;
    next?: string | null;
    inviteId?: string | null;
  }): Promise<{ url: string; state: string }>;
  /** A volta: o token que abre a sessão do convidado, e para onde seguir. */
  completeSignIn(state: string, code: string): Promise<{ token: string; tenantId: string; next: string | null }>;
}
