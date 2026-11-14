import React, { Suspense } from 'react';
import { RiCloseLine } from 'react-icons/ri';
import { useWorkspaceDockViewModel } from './WorkspaceDock.viewmodel';
import { S } from './WorkspaceDock.styles';
import { ErrorBoundary } from '../ErrorBoundary';
import { WidgetRenderer } from '../../ui/WidgetRenderer';
import { Spinner } from '../../ui/Spinner';
import { getScreenIcon } from '../../../shared/screenIcons';
import { useT } from '../../../shared/i18n/useT';
import type { SurfaceSlotDescriptor } from '../../../shared/settings/useSettingsCatalog';

const logPanelFailure = (key: string) => (error: Error): void => {
  console.error(`[dock ${key}]`, error);
};

const DockPanel: React.FC<{ panel: SurfaceSlotDescriptor; hidden: boolean }> = ({ panel, hidden }) => {
  const t = useT('core.ui');
  const Component = panel.component;
  return (
    <S.Panel $hidden={hidden}>
      <ErrorBoundary
        fallback={<S.Failure>{t('slot.render-failed', { title: panel.title })}</S.Failure>}
        onError={logPanelFailure(panel.key)}
      >
        {/* Painel de plugin interno chega por carga preguiçosa: o código só desce quando o dock abre. */}
        <Suspense fallback={<S.Loading><Spinner size={20} /></S.Loading>}>
          {Component ? <Component /> : <WidgetRenderer spec={panel.spec} />}
        </Suspense>
      </ErrorBoundary>
    </S.Panel>
  );
};

/**
 * O painel fixado à direita do espaço de trabalho (`dock.right`). Não conhece nenhum painel — só a
 * região. Fechado e sem nada aberto antes, não desenha nada; depois de aberto, o painel continua
 * montado (escondido) para que uma conversa em andamento não se perca ao fechar o dock.
 */
export const WorkspaceDock: React.FC = () => {
  const vm = useWorkspaceDockViewModel();
  const t = useT('core.ui');

  if (vm.mounted.length === 0 && !vm.active) return null;

  return (
    <S.Dock $hidden={!vm.active} style={{ width: vm.width }} aria-label={vm.active?.title}>
      <S.ResizeHandle
        $active={vm.resizing}
        onPointerDown={vm.startResize}
        role="separator"
        aria-orientation="vertical"
        aria-label={t('dock.resize')}
      />
      <S.Header>
        {vm.panels.length > 1 ? (
          <S.Tabs role="tablist">
            {vm.panels.map((panel) => (
              <S.Tab
                key={panel.key}
                role="tab"
                aria-selected={vm.active?.key === panel.key}
                $active={vm.active?.key === panel.key}
                onClick={() => vm.select(panel.key)}
              >
                {getScreenIcon(panel.icon ?? 'sparkling', 14)}
                {panel.title}
              </S.Tab>
            ))}
          </S.Tabs>
        ) : (
          <S.Title>
            {getScreenIcon(vm.active?.icon ?? 'sparkling', 16)}
            {vm.active?.title}
          </S.Title>
        )}
        <S.CloseButton onClick={vm.close} title={t('dock.close')} aria-label={t('dock.close')}>
          <RiCloseLine size={16} />
        </S.CloseButton>
      </S.Header>
      <S.Body>
        {vm.mounted.map((panel) => (
          <DockPanel key={panel.key} panel={panel} hidden={vm.active?.key !== panel.key} />
        ))}
      </S.Body>
    </S.Dock>
  );
};
