import { createContext, useContext } from 'react';
import type { PortalContext, PortalDocument, PortalMembership, PortalRecord } from '../domain/entities/Portal';

export interface PortalStoreValue {
  memberships: PortalMembership[];
  membershipsLoading: boolean;
  tenantId: string | null;
  context: PortalContext | null;
  contextLoading: boolean;
  /** Chave de mensagem — o convite pode ter sido revogado, ou o escritório não expõe nada. */
  error: string | null;
  collection: string | null;
  records: PortalRecord[];
  recordsLoading: boolean;
  selectTenant: (tenantId: string) => void;
  selectCollection: (collection: string) => void;
  getDocuments: (projectionId: string) => Promise<PortalDocument[]>;
  getDocumentUrl: (projectionId: string, documentId: string) => Promise<string>;
}

export const PortalStoreContext = createContext<PortalStoreValue | null>(null);

export const usePortal = (): PortalStoreValue => {
  const ctx = useContext(PortalStoreContext);
  if (!ctx) throw new Error('usePortal must be used within PortalStoreProvider');
  return ctx;
};
