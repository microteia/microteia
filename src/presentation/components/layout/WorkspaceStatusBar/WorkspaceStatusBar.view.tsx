import React from 'react';
import { RiBuilding2Line, RiKeyboardLine, RiShieldCheckLine } from 'react-icons/ri';
import { useWorkspaceStatusBarViewModel } from './WorkspaceStatusBar.viewmodel';
import { S } from './WorkspaceStatusBar.styles';

export const WorkspaceStatusBar: React.FC = () => {
  const vm = useWorkspaceStatusBarViewModel();

  return (
    <S.Bar>
      <S.Side>
        {vm.tenantName && (
          <S.Item>
            <RiBuilding2Line />
            {vm.tenantName}
          </S.Item>
        )}
      </S.Side>

      <S.Side>
        <S.Item>
          <RiKeyboardLine />
          ⌘K Paleta de comandos
        </S.Item>
        <S.Link href="/license" target="_blank" rel="noopener noreferrer">
          <RiShieldCheckLine />
          Termos e Privacidade
        </S.Link>
        <S.Item>v{vm.version}</S.Item>
      </S.Side>
    </S.Bar>
  );
};
