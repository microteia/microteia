import { useCallback, useMemo, useState } from 'react';
import { useAuthorization } from '../../../stores/useAuthorization';
import { PERMISSION_RECORD_IMPORT_RUN } from '../../../domain/schema/access';
import { importParentFieldIssue } from '../../../domain/schema/recordImportReference';
import type { RecordImportParent } from '../../../domain/schema/recordImport';
import { useSchemaContext } from '../useSchemaContext';

/**
 * A importação por arquivo oferecida na aba de um registro-pai. O diálogo é o mesmo da lista própria
 * da tela; o que muda é que o vínculo com o pai sai do mapeamento e o servidor o grava em cada linha.
 */
export interface RecordListImport {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  parent: RecordImportParent;
  /** O título da tela, já resolvido — o diálogo diz ONDE os registros vão entrar. */
  screenTitle: string;
}

export interface ParentRecordImportSource {
  collection: string;
  /** Os campos da trava e o registro aberto. Ausente, a lista não é de uma aba de pai. */
  parent?: { fieldKeys: string[]; recordId: string };
  screenTitle: string;
  isAvailable: boolean;
  canCreate: boolean;
  canUpdate: boolean;
}

/**
 * Só a trava por UM campo de referência a um registro só: com vários campos, a linha não diria por qual
 * deles o pai entra; num `multi`, gravar o pai substituiria os outros ids da lista. Fora disso — e para
 * quem não tem `record-import.run`, ou não pode criar NEM alterar na coleção — não há botão: oferecer o
 * que viria todo recusado é fazer a pessoa descobrir o próprio acesso por tentativa.
 */
export const useParentRecordImport = (source: ParentRecordImportSource): RecordListImport | null => {
  const { collection, parent, screenTitle, isAvailable, canCreate, canUpdate } = source;
  const { can } = useAuthorization();
  const ctx = useSchemaContext();
  const [isOpen, setIsOpen] = useState(false);
  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  const fieldKey = parent?.fieldKeys.length === 1 ? parent.fieldKeys[0] : null;
  const recordId = parent?.recordId ?? '';
  const eligible = isAvailable
    && fieldKey !== null
    && recordId !== ''
    && (canCreate || canUpdate)
    && can(PERMISSION_RECORD_IMPORT_RUN)
    && importParentFieldIssue(ctx, collection, fieldKey) === null;

  return useMemo(
    () => (eligible && fieldKey
      ? { isOpen, open, close, parent: { fieldKey, recordId }, screenTitle }
      : null),
    [eligible, fieldKey, recordId, isOpen, open, close, screenTitle],
  );
};
