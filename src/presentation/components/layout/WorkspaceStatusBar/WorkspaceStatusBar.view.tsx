import React from 'react';
import { RiBuilding2Line, RiKeyboardLine, RiShieldCheckLine, RiVipCrownLine } from 'react-icons/ri';
import { useWorkspaceStatusBarViewModel } from './WorkspaceStatusBar.viewmodel';
import { S } from './WorkspaceStatusBar.styles';
import { SlotSurface } from '../SlotSurface';
import { WORKSPACE_SLOT_SURFACES } from '../../../../domain/schema/ui/uiExtensionPoints';

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
        <SlotSurface surface={WORKSPACE_SLOT_SURFACES.statusBarLeft} />
      </S.Side>

      <S.Side>
        <S.Item>
          <RiKeyboardLine />
          {t('status.command-palette')}
        </S.Item>
        <S.LinkButton type="button" onClick={vm.openTerms}>
          <RiShieldCheckLine />
          {t('status.terms')}
        </S.LinkButton>
        <S.Item>v{vm.version}</S.Item>
        <SlotSurface surface={WORKSPACE_SLOT_SURFACES.statusBarRight} />
      </S.Side>
    </S.Bar>
  );
};
