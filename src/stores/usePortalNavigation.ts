import { createContext, useContext } from 'react';

/** Um registro aberto no portal, pela PROJEÇÃO dele (`colecao__id`). */
export interface PortalOpenRecord {
  collection: string;
  projectionId: string;
}

export interface PortalCreating {
  collection: string;
  /** O registro-pai, quando o novo nasce dentro dele — e aí o formulário não pergunta. */
  parentRecordId: string | null;
  /** Presente, o formulário ALTERA este registro (o id do registro, não da projeção). */
  recordId?: string | null;
}

/**
 * Onde o convidado está no portal. Mora num contexto, e não no ViewModel da casca, porque as views de
 * EXTENSÃO navegam também (`@microteia/portal`): abrir um registro, voltar, criar — e precisam mexer na
 * mesma pilha que a casca genérica mostra.
 */
export interface PortalNavigationValue {
  /** A pilha do que foi aberto, DENTRO do item do menu aberto: o prestador, depois a nota dele. */
  stack: PortalOpenRecord[];
  creating: PortalCreating | null;
  justSubmitted: boolean;
  /** A alteração acabou de ser gravada — a casca avisa até o próximo gesto. */
  justSaved: boolean;
  openRecord: (collection: string, projectionId: string) => void;
  back: () => void;
  startCreate: (collection: string, parentRecordId: string | null) => void;
  startEdit: (collection: string, recordId: string) => void;
  cancelCreate: () => void;
  submitted: () => void;
  saved: () => void;
}

export const PortalNavigationContext = createContext<PortalNavigationValue | null>(null);

export const usePortalNavigation = (): PortalNavigationValue => {
  const ctx = useContext(PortalNavigationContext);
  if (!ctx) throw new Error('usePortalNavigation must be used within PortalNavigationProvider');
  return ctx;
};
