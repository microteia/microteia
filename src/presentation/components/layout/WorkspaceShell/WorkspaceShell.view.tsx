import React from 'react';
import { useWorkspace } from '../../../../stores/useWorkspace';
import { useCommandPalette } from '../../../../stores/useCommandPalette';
import { useTenant } from '../../../../stores/useTenant';
import { WorkspaceSidebar } from '../WorkspaceSidebar';
import { WorkspacePanelNode } from '../WorkspacePanelNode';
import { NotificationBanner } from '../NotificationBanner';
import { TopBar } from '../TopBar';
import { WorkspaceStatusBar } from '../WorkspaceStatusBar';
import { CommandPalette } from '../../ui/CommandPalette';
import { useWorkspaceShellViewModel } from './WorkspaceShell.viewmodel';
import { S } from './WorkspaceShell.styles';

export const WorkspaceShell: React.FC = () => {
  useWorkspaceShellViewModel();
  const { layout } = useWorkspace();
  const { isOpen: isCommandPaletteOpen } = useCommandPalette();
  const { initError } = useTenant();

  return (
    <S.Shell>
      <S.Root>
        <WorkspaceSidebar />

        <S.WorkspaceArea>
          <TopBar />
          {initError ? (
            <S.ErrorBanner>
              <S.ErrorTitle>Falha ao conectar ao banco de dados</S.ErrorTitle>
              <S.ErrorDetail>
                {initError.includes('permission') || initError.includes('insufficient')
                  ? 'Permissões do Firestore não configuradas. Configure as regras de segurança no Firebase Console e recarregue a página.'
                  : initError}
              </S.ErrorDetail>
            </S.ErrorBanner>
          ) : (
            <S.PanelArea>
              <WorkspacePanelNode node={layout} />
            </S.PanelArea>
          )}
        </S.WorkspaceArea>

        <NotificationBanner />
        {isCommandPaletteOpen && <CommandPalette />}
      </S.Root>

      <WorkspaceStatusBar />
    </S.Shell>
  );
};
