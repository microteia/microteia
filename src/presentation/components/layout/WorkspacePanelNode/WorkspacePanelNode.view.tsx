import React from 'react';
import { RiLayoutGridLine } from 'react-icons/ri';
import { useWorkspace } from '../../../../stores/useWorkspace';
import type { PanelNode, PanelSplit } from '../../../../stores/useWorkspace';
import { Spinner } from '../../ui/Spinner';
import { useResolvePage } from '../../../shared/useUiContributions';
import { TabBar } from '../TabBar';
import { useSplitResizerViewModel } from './WorkspacePanelNode.viewmodel';
import { S } from './WorkspacePanelNode.styles';

import { useT } from '../../../shared/i18n/useT';

interface WorkspacePanelNodeProps {
  node: PanelNode;
}

export const WorkspacePanelNode: React.FC<WorkspacePanelNodeProps> = ({ node }) => {
  if (node.type === 'panel') return <PanelLeaf panelId={node.panelId} />;
  return <SplitNode node={node} />;
};

const PanelLeaf: React.FC<{ panelId: string }> = ({ panelId }) => {
  const t = useT('core.ui');
  const { panels, activePanelId, setActivePanelId } = useWorkspace();
  const resolvePage = useResolvePage();
  const panel = panels[panelId];
  const hasMultiplePanels = Object.keys(panels).length > 1;
  const isActive = hasMultiplePanels && activePanelId === panelId;
  const activeKey = panel?.activeTabKey ?? null;
  const tabKeys = panel?.tabKeys ?? [];
  const activePage = activeKey ? resolvePage(activeKey) : undefined;

  return (
    <S.PanelLeaf onClick={() => !isActive && setActivePanelId(panelId)}>
      <TabBar panelId={panelId} />
      <S.PanelContent $noPadding={activePage?.metadata.fullBleed}>
        {tabKeys.length === 0 ? (
          <S.EmptyPanel>
            <S.EmptyIcon><RiLayoutGridLine /></S.EmptyIcon>
            {t('workspace.empty')}
          </S.EmptyPanel>
        ) : (
          tabKeys.map((tabKey) => {
            const PageComponent = resolvePage(tabKey)?.Component;
            if (!PageComponent) return null;
            return (
              <S.TabPane key={tabKey} $active={tabKey === activeKey}>
                <React.Suspense fallback={<S.PageLoading><Spinner /></S.PageLoading>}>
                  <PageComponent tabKey={tabKey} />
                </React.Suspense>
              </S.TabPane>
            );
          })
        )}
      </S.PanelContent>
    </S.PanelLeaf>
  );
};

const SplitNode: React.FC<{ node: PanelSplit }> = ({ node }) => {
  const { containerRef, handleResizerMouseDown } = useSplitResizerViewModel();

  return (
    <S.SplitContainer ref={containerRef} $direction={node.direction}>
      <S.SplitChild $flex={node.ratio}>
        <WorkspacePanelNode node={node.first} />
      </S.SplitChild>
      <S.Resizer
        $direction={node.direction}
        onMouseDown={e => handleResizerMouseDown(e, node)}
      />
      <S.SplitChild $flex={1 - node.ratio}>
        <WorkspacePanelNode node={node.second} />
      </S.SplitChild>
    </S.SplitContainer>
  );
};
