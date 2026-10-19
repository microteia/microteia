import { createContext, useContext } from 'react';
import type { PortalContext, PortalDocument, PortalLinkOption, PortalMembership, PortalRecord } from '../domain/entities/Portal';

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
   * tentativa. Juntar as duas mostrava "você não tem acesso" a quem tinha.
   */
  error: 'not-invited' | 'failed' | null;
  /** O código do erro, para quem precisa reportá-lo. */
  errorCode: string | null;
  retryContext: () => void;
  retryMemberships: () => void;
  collection: string | null;
  records: PortalRecord[];
  recordsLoading: boolean;
  selectTenant: (tenantId: string) => void;
  selectCollection: (collection: string) => void;
  getDocuments: (projectionId: string) => Promise<PortalDocument[]>;
  getDocumentUrl: (projectionId: string, documentId: string) => Promise<string>;
  listLinkOptions: (collection: string) => Promise<PortalLinkOption[]>;
  submit: (collection: string, linkRecordId: string, data: Record<string, unknown>) => Promise<void>;
}

export const PortalStoreContext = createContext<PortalStoreValue | null>(null);

export const usePortal = (): PortalStoreValue => {
  const ctx = useContext(PortalStoreContext);
  if (!ctx) throw new Error('usePortal must be used within PortalStoreProvider');
  return ctx;
};
