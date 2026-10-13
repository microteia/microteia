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
import { RecordDialogOutlet } from '../RecordDialogOutlet';
import { useWorkspaceShellViewModel } from './WorkspaceShell.viewmodel';
import { S } from './WorkspaceShell.styles';

import { useT } from '../../../shared/i18n/useT';
export const WorkspaceShell: React.FC = () => {
  useWorkspaceShellViewModel();
  const t = useT('core.ui');
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
              <S.ErrorTitle>{t('error.db-connect')}</S.ErrorTitle>
              <S.ErrorDetail>
                {initError.includes('permission') || initError.includes('insufficient')
                  ? t('error.firestore-rules')
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
        <RecordDialogOutlet />
      </S.Root>

      <WorkspaceStatusBar />
    </S.Shell>
  );
};
