import React from 'react';
import { useRecordDialogOutletViewModel } from './RecordDialogOutlet.viewmodel';

/**
 * Onde o diálogo de um gesto de registro é desenhado — uma vez, no shell, para o cartão da listagem,
 * o cabeçalho do detalhe e a aba de outro registro.
 */
export const RecordDialogOutlet: React.FC = () => {
  const vm = useRecordDialogOutletViewModel();
  if (!vm.dialog) return null;
  const Dialog = vm.dialog.component;
  return <Dialog {...vm.dialog.props} onClose={vm.close} />;
};
