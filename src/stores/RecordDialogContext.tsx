import React, { useCallback, useMemo, useState } from 'react';
import { RecordDialogContext } from './useRecordDialog';
import type { OpenRecordDialog } from './useRecordDialog';

/**
 * O diálogo que um GESTO de registro abre — um por vez, para o workspace inteiro.
 *
 * Existe para que uma ação de registro que precisa perguntar algo antes de agir (que modelo, em que
 * formato) não obrigue cada superfície — o cartão da listagem, o cabeçalho do detalhe, a aba de outro
 * registro — a ganhar um estado e um modal próprios. A ação abre; o outlet do shell desenha.
 */
export const RecordDialogProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [dialog, setDialog] = useState<OpenRecordDialog | null>(null);

  const open = useCallback((next: OpenRecordDialog) => setDialog(next), []);
  const close = useCallback(() => setDialog(null), []);

  const value = useMemo(() => ({ dialog, open, close }), [dialog, open, close]);

  return <RecordDialogContext.Provider value={value}>{children}</RecordDialogContext.Provider>;
};
