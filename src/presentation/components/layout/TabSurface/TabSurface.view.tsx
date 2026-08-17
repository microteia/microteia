import React from 'react';
import { S } from './TabSurface.styles';
import { useTabSurfaceViewModel } from './TabSurface.viewmodel';
import type { SurfaceTabDescriptor } from '../../../shared/settings/useSettingsCatalog';
import { ErrorBoundary } from '../ErrorBoundary';
import { WidgetRenderer } from '../../ui/WidgetRenderer';
import { getScreenIcon } from '../../../shared/screenIcons';
import { useT } from '../../../shared/i18n/useT';

interface TabSurfaceProps {
  /** O nome da superfície. Quem contribui uma aba declara este mesmo nome. */
  surface: string;
  /** Aba aberta ao montar. Chave desconhecida cai na primeira visível. */
  initialKey?: string;
}

const logTabFailure = (key: string) => (error: Error): void => {
  console.error(`[tab ${key}]`, error);
};

const TabPanel: React.FC<{ tab: SurfaceTabDescriptor }> = ({ tab }) => {
  const t = useT('core.ui');
  const Component = tab.component;
  return (
    <S.Panel>
      <S.PanelBody>
        <ErrorBoundary
          fallback={<S.Failure>{t('tab.render-failed', { title: tab.title })}</S.Failure>}
          onError={logTabFailure(tab.key)}
        >
          {Component ? <Component /> : <WidgetRenderer spec={tab.spec} />}
        </ErrorBoundary>
      </S.PanelBody>
    </S.Panel>
  );
};

/**
 * A superfície de abas: a faixa que renderiza o que as extensões registraram, na ordem que a
 * configuração mandar. Não conhece nenhuma aba — só o NOME da superfície.
 *
 * Cada aba vive dentro do próprio limite de erro, como os widgets: uma aba que quebra vira um aviso
 * naquele espaço, e a faixa continua navegável.
 */
export const TabSurface: React.FC<TabSurfaceProps> = ({ surface, initialKey }) => {
  const vm = useTabSurfaceViewModel({ surface, initialKey });
  const t = useT('core.ui');

  if (!vm.activeTab) {
    return <S.Empty>{vm.isAllHidden ? t('tab.none-active') : t('tab.none-available')}</S.Empty>;
  }

  return (
    <S.Wrapper>
      <S.TabsBar>
        {vm.tabs.map((tab) => (
          <S.Tab
            key={tab.key}
            $active={tab.key === vm.activeKey}
            onClick={() => vm.setActiveKey(tab.key)}
          >
            {tab.icon && getScreenIcon(tab.icon, 16)}
            {tab.title}
          </S.Tab>
        ))}
      </S.TabsBar>

      <S.Content>
        <TabPanel key={vm.activeTab.key} tab={vm.activeTab} />
      </S.Content>
    </S.Wrapper>
  );
};
