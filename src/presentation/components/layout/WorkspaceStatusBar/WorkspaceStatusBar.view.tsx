import React from 'react';
import { RiBuilding2Line, RiKeyboardLine, RiShieldCheckLine, RiVipCrownLine } from 'react-icons/ri';
import { useWorkspaceStatusBarViewModel } from './WorkspaceStatusBar.viewmodel';
import { S } from './WorkspaceStatusBar.styles';

import { useT } from '../../../shared/i18n/useT';

export const WorkspaceStatusBar: React.FC = () => {
  const t = useT('core.ui');
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
        {vm.planLabel && (
          <S.PlanBadge>
            <RiVipCrownLine />
            {vm.planLabel}
            <S.PlanUsage>
              {vm.memberCount}/{vm.memberLimit ?? '∞'}
            </S.PlanUsage>
          </S.PlanBadge>
        )}
      </S.Side>

      <S.Side>
        <S.Item>
          <RiKeyboardLine />
          {t('status.command-palette')}
        </S.Item>
        <S.Link href="/license" target="_blank" rel="noopener noreferrer">
          <RiShieldCheckLine />
          {t('status.terms')}
        </S.Link>
        <S.Item>v{vm.version}</S.Item>
      </S.Side>
    </S.Bar>
  );
};
