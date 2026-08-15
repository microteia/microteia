import React from 'react';
import { RiEyeLine } from 'react-icons/ri';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { InfoBanner } from '../../../components/ui/InfoBanner';
import { CodeEditor } from '../../../components/ui/CodeEditor';
import { SearchSelect } from '../../../components/ui/SearchSelect';
import { SplitPane } from '../../../components/ui/SplitPane';
import { ErrorBoundary } from '../../../components/layout/ErrorBoundary/ErrorBoundary';
import { ExtensionPreviewHost } from '../../../shared/extensions/ExtensionPreviewHost';
import { useCodeViewEditorModalViewModel, type CodeViewEditorModalProps } from './CodeViewEditorModal.viewmodel';
import { S } from './CodeViewEditorModal.styles';

import { useT } from '../../../shared/i18n/useT';

const swallowPreviewError = (): void => { /* erros de render aparecem no fallback do ErrorBoundary */ };

export const CodeViewEditorModal: React.FC<CodeViewEditorModalProps> = ({ isOpen, view, iconOptions, onChange, onClose, extensionTypeDefs }) => {
  const t = useT('core.marketplace');
  const vm = useCodeViewEditorModalViewModel();
  if (!isOpen || !view) return null;

  return (
    <Modal 
      title={t('author.view.modal-title', { name: view.title || view.key || t('author.view.untitled') })} 
      onClose={onClose} 
      size="xlarge"
      maximizable
      maximized={vm.maximized}
      onToggleMaximize={vm.toggleMaximized}
    >
      <S.Fields>
        <S.Field>
          {t('author.view.title')}
          <S.Input value={view.title} onChange={(e) => onChange({ title: e.target.value })} />
        </S.Field>
        <S.Field>
          {t('author.view.key')}
          <S.Input value={view.key} onChange={(e) => onChange({ key: e.target.value })} placeholder={t('author.view.key.placeholder')} />
        </S.Field>
        <S.Field>
          {t('core.records/screen.icon')}
          <SearchSelect options={iconOptions} value={view.icon} onChange={(icon) => onChange({ icon })} placeholder={t('core.records/screen.icon')} />
        </S.Field>
      </S.Fields>

      <S.Toolbar>
        <Button variant="ghost" size="sm" onClick={vm.togglePreview}>
          <RiEyeLine size={16} /> {t(vm.previewOpen ? 'author.preview.hide' : 'author.preview.show')}
        </Button>
        {view.error && <S.Error>{t('author.compile-error.detail', { error: view.error })}</S.Error>}
      </S.Toolbar>

      <S.Split>
        <SplitPane
          showRight={vm.previewOpen}
          left={<CodeEditor value={view.source} onChange={(source) => onChange({ source })} minHeight={vm.maximized ? "calc(100vh - 300px)" : "calc(62vh - 44px)"} extraLib={extensionTypeDefs} />}
          right={(
            <S.PreviewPane>
              <ErrorBoundary
                key={view.source}
                fallback={<InfoBanner message={t('author.preview.failed')} variant="warning" />}
                onError={swallowPreviewError}
              >
                <ExtensionPreviewHost source={view.source} />
              </ErrorBoundary>
            </S.PreviewPane>
          )}
        />
      </S.Split>
    </Modal>
  );
};
