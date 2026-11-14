import React from 'react';
import { useWorkspaceDockTogglesViewModel } from './WorkspaceDockToggles.viewmodel';
import { S } from './WorkspaceDockToggles.styles';
import { getScreenIcon } from '../../../shared/screenIcons';
import { useT } from '../../../shared/i18n/useT';

/** Um botão por painel do dock, na barra do topo. Sem painel disponível, não desenha nada. */
export const WorkspaceDockToggles: React.FC = () => {
  const vm = useWorkspaceDockTogglesViewModel();
  const t = useT('core.ui');

  if (vm.toggles.length === 0) return null;

  return (
    <S.Row>
      {vm.toggles.map((toggle) => (
        <S.Button
          key={toggle.key}
          $active={toggle.active}
          onClick={() => vm.toggle(toggle.key)}
          title={t('dock.toggle', { title: toggle.title })}
          aria-label={toggle.title}
          aria-pressed={toggle.active}
        >
          {getScreenIcon(toggle.icon, 18)}
        </S.Button>
      ))}
    </S.Row>
  );
};
