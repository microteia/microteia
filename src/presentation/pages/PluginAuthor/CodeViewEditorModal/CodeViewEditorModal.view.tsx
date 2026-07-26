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

const swallowPreviewError = (): void => { /* erros de render aparecem no fallback do ErrorBoundary */ };

export const CodeViewEditorModal: React.FC<CodeViewEditorModalProps> = ({ isOpen, view, iconOptions, onChange, onClose, extensionTypeDefs }) => {
  const vm = useCodeViewEditorModalViewModel();
  if (!isOpen || !view) return null;

  return (
    <Modal 
      title={`Tela de código — ${view.title || view.key || 'sem título'}`} 
      onClose={onClose} 
      size="xlarge"
      maximizable
      maximized={vm.maximized}
      onToggleMaximize={vm.toggleMaximized}
    >
      <S.Fields>
        <S.Field>
          Título
          <S.Input value={view.title} onChange={(e) => onChange({ title: e.target.value })} />
        </S.Field>
        <S.Field>
          Chave (menu e endereço)
          <S.Input value={view.key} onChange={(e) => onChange({ key: e.target.value })} placeholder="minha-tela" />
        </S.Field>
        <S.Field>
          Ícone
          <SearchSelect options={iconOptions} value={view.icon} onChange={(icon) => onChange({ icon })} placeholder="Ícone" />
        </S.Field>
      </S.Fields>

      <S.Toolbar>
        <Button variant="ghost" size="sm" onClick={vm.togglePreview}>
          <RiEyeLine size={16} /> {vm.previewOpen ? 'Ocultar pré-visualização' : 'Pré-visualizar ao lado'}
        </Button>
        {view.error && <S.Error>Não compila: {view.error}</S.Error>}
      </S.Toolbar>

      <S.Split>
        <SplitPane
          showRight={vm.previewOpen}
          left={<CodeEditor value={view.source} onChange={(source) => onChange({ source })} minHeight={vm.maximized ? "calc(100vh - 300px)" : "calc(62vh - 44px)"} extraLib={extensionTypeDefs} />}
          right={(
            <S.PreviewPane>
              <ErrorBoundary
                key={view.source}
                fallback={<InfoBanner message="Não foi possível renderizar a pré-visualização. Verifique o código." variant="warning" />}
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
