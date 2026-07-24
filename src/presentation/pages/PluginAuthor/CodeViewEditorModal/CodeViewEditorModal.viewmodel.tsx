import { useCallback, useState } from 'react';
import type { CodeViewEditing } from '../PluginAuthor.viewmodel';
import type { SearchSelectOption } from '../../../components/ui/SearchSelect';

export interface CodeViewEditorModalProps {
  isOpen: boolean;
  view: CodeViewEditing | null;
  iconOptions: SearchSelectOption[];
  onChange: (patch: Partial<Omit<CodeViewEditing, 'error'>>) => void;
  onClose: () => void;
}

export interface CodeViewEditorModalViewModel {
  previewOpen: boolean;
  togglePreview: () => void;
}

export const useCodeViewEditorModalViewModel = (): CodeViewEditorModalViewModel => {
  const [previewOpen, setPreviewOpen] = useState(false);
  const togglePreview = useCallback(() => setPreviewOpen((open) => !open), []);
  return { previewOpen, togglePreview };
};
