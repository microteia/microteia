import React from 'react';
import { RiLayoutGridLine } from 'react-icons/ri';
import { useWorkspace } from '../../../../stores/useWorkspace';
import type { PanelNode, PanelSplit } from '../../../../stores/useWorkspace';
import { getPageByKey } from '../../../pages/pageRegistry';
import { TabBar } from '../TabBar';
import { useSplitResizerViewModel } from './WorkspacePanelNode.viewmodel';
import { S } from './WorkspacePanelNode.styles';

interface WorkspacePanelNodeProps {
  node: PanelNode;
}

export const WorkspacePanelNode: React.FC<WorkspacePanelNodeProps> = ({ node }) => {
  if (node.type === 'panel') return <PanelLeaf panelId={node.panelId} />;
  return <SplitNode node={node} />;
};

const PanelLeaf: React.FC<{ panelId: string }> = ({ panelId }) => {
  const { panels, activePanelId, setActivePanelId } = useWorkspace();
  const panel = panels[panelId];
  const isActive = activePanelId === panelId;
  const activeKey = panel?.activeTabKey ?? null;
  const tabKeys = panel?.tabKeys ?? [];
  const activePage = activeKey ? getPageByKey(activeKey) : undefined;

  return (
    <S.PanelLeaf $active={isActive} onClick={() => !isActive && setActivePanelId(panelId)}>
      <TabBar panelId={panelId} />
      <S.PanelContent $noPadding={activePage?.fullBleed}>
        {tabKeys.length === 0 ? (
          <S.EmptyPanel>
            <S.EmptyIcon><RiLayoutGridLine /></S.EmptyIcon>
            Clique em um item do menu para abrir
          </S.EmptyPanel>
        ) : (
          tabKeys.map((tabKey) => {
            const pageDef = getPageByKey(tabKey);
            const PageComponent = pageDef?.component;
            if (!PageComponent) return null;
            return (
              <S.TabPane key={tabKey} $active={tabKey === activeKey}>
                <PageComponent tabKey={tabKey} />
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
