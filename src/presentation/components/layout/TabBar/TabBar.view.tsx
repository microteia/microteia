import React from 'react';
import { createPortal } from 'react-dom';
import { RiCloseLine, RiLayoutColumnLine, RiLayoutRowLine, RiCloseCircleLine } from 'react-icons/ri';
import { useTabBarViewModel } from './TabBar.viewmodel';
import type { TabBarProps } from './TabBar.viewmodel';
import { S } from './TabBar.styles';

import { useT } from '../../../shared/i18n/useT';
export const TabBar: React.FC<TabBarProps> = ({ panelId }) => {
  const vm = useTabBarViewModel({ panelId });
  const t = useT('core.ui');

  return (
    <>
      <S.Bar>
        <S.TabList>
          {vm.tabs.map(tab => (
            <S.Tab
              key={tab.key}
              $active={tab.isActive}
              data-tabkey={tab.key}
              data-panelid={panelId}
              onClick={() => vm.handleTabClick(tab.key)}
              onContextMenu={e => vm.handleTabContextMenu(e, tab.key)}
              title={tab.title}
            >
              <span className="tab-icon">{tab.icon}</span>
              <S.TabTitle>{tab.title}</S.TabTitle>
              <S.CloseBtn
                $active={tab.isActive}
                onClick={e => vm.handleTabClose(e, tab.key)}
                title={t('action.close')}
              >
                <RiCloseLine size={13} />
              </S.CloseBtn>
            </S.Tab>
          ))}
        </S.TabList>
        {vm.canClosePanel && (
          <S.PanelCloseBtn $active={vm.isPanelActive} onClick={vm.handleClosePanel} title={t('tab.close-panel')}>
            <RiCloseLine size={15} />
          </S.PanelCloseBtn>
        )}
      </S.Bar>

      {vm.contextMenu.visible && createPortal(
        <S.ContextMenu
          style={{ top: vm.contextMenu.y, left: vm.contextMenu.x }}
          onMouseDown={vm.handleMenuMouseDown}
        >
          {vm.canSplit && (
            <>
              <S.ContextItem onClick={() => vm.handleSplitFromMenu('horizontal')}>
                <RiLayoutColumnLine size={15} />
                {t('tab.split-right')}
              </S.ContextItem>
              <S.ContextItem onClick={() => vm.handleSplitFromMenu('vertical')}>
                <RiLayoutRowLine size={15} />
                {t('tab.split-below')}
              </S.ContextItem>
              <S.ContextSeparator />
            </>
          )}
          {vm.canCloseOthers && (
            <S.ContextItem onClick={vm.handleCloseOthersFromMenu}>
              <RiCloseCircleLine size={15} />
              {t('tab.close-others')}
            </S.ContextItem>
          )}
          <S.ContextItem $danger onClick={vm.handleCloseFromMenu}>
            <RiCloseLine size={15} />
            {t('tab.close')}
          </S.ContextItem>
        </S.ContextMenu>,
        document.body,
      )}
    </>
  );
};
