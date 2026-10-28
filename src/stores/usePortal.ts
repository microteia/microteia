import { createContext, useContext } from 'react';
import type {
  PortalActionOutcome,
  PortalContext,
  PortalDocument,
  PortalLinkOption,
  PortalMembership,
  PortalRecord,
  PortalRecordAction,
} from '../domain/entities/Portal';
import type { PortalProfile } from '../domain/schema/portal';

export interface PortalStoreValue {
  memberships: PortalMembership[];
  membershipsLoading: boolean;
  /** A consulta dos convites FALHOU — diferente de não haver convite nenhum. */
  membershipsFailed: boolean;
  tenantId: string | null;
  context: PortalContext | null;
  contextLoading: boolean;
  /**
   * Por que o contexto não veio. `not-invited` só quando o SERVIDOR disse que a pessoa não é
   * convidada; qualquer outra falha — função iniciando, rede, erro interno — é `failed`, com nova
   * tentativa. Juntar as duas mostrava "você não tem acesso" a quem tinha. `identity-required` é o
   * convite suspenso: o escritório desligou o link de e-mail, e a pessoa tem de entrar por um provedor.
   */
  error: 'not-invited' | 'identity-required' | 'failed' | null;
  /** O código do erro, para quem precisa reportá-lo. */
  errorCode: string | null;
  retryContext: () => void;
  retryMemberships: () => void;
  /**
   * Os registros de TODAS as telas do portal, assinados juntos. Trocar de aba ou abrir um pai não
   * espera rede: era cada clique abrindo uma consulta do zero que deixava a navegação lenta.
   */
  recordsByCollection: Record<string, PortalRecord[]>;
  /** A coleção ainda não recebeu o primeiro retrato. */
  isCollectionLoading: (collection: string) => boolean;
  selectTenant: (tenantId: string) => void;
  /** Os filhos de um registro, os mais recentes primeiro, até `max` — ver `subscribeChildren`. */
  subscribeChildren: (
    collection: string,
    parentKey: string,
    max: number,
    onUpdate: (records: PortalRecord[]) => void,
    onError: () => void,
  ) => () => void;
  getDocuments: (projectionId: string) => Promise<PortalDocument[]>;
  getDocumentUrl: (projectionId: string, documentId: string) => Promise<string>;
  /** Avisa o servidor de que o convidado abriu o registro — ver `IPortalRepository.recordView`. */
  recordView: (projectionId: string) => Promise<void>;
  /** Os botões do registro aberto (`portal.actions`) — ver `IPortalRepository.listRecordActions`. */
  listRecordActions: (projectionId: string) => Promise<PortalRecordAction[]>;
  /** Dispara uma ação do escritório no registro aberto; devolve o status e os botões refeitos. */
  runRecordAction: (projectionId: string, actionId: string) => Promise<PortalActionOutcome>;
  listLinkOptions: (collection: string) => Promise<PortalLinkOption[]>;
  submit: (collection: string, linkRecordId: string, data: Record<string, unknown>) => Promise<void>;
  /** Altera um registro do convidado — o servidor confere campos, momento e dono. */
  update: (collection: string, recordId: string, data: Record<string, unknown>) => Promise<void>;
  /** O uid do convidado — o dono de um registro criado por ele (`onlyOwn`). */
  userId: string | null;
  /** O perfil do convidado no escritório aberto — vazio enquanto ele não o preencher. */
  profile: PortalProfile;
  saveProfile: (profile: PortalProfile) => Promise<void>;
  /** Anexa um documento a um registro, com um dos tipos que a tela oferece. */
  uploadDocument: (collection: string, recordId: string, file: File, type: string) => Promise<void>;
}

export const PortalStoreContext = createContext<PortalStoreValue | null>(null);

export const usePortal = (): PortalStoreValue => {
  const ctx = useContext(PortalStoreContext);
  if (!ctx) throw new Error('usePortal must be used within PortalStoreProvider');
  return ctx;
};
