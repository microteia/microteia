import { useRecordDialog } from '../../../../stores/useRecordDialog';
import type { OpenRecordDialog } from '../../../../stores/useRecordDialog';

export interface RecordDialogOutletViewModel {
  dialog: OpenRecordDialog | null;
  close: () => void;
}

export const useRecordDialogOutletViewModel = (): RecordDialogOutletViewModel => {
  const { dialog, close } = useRecordDialog();
  return { dialog, close };
};
