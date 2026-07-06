import React, { useEffect } from 'react';
import styled from 'styled-components';
import { RiCloseLine } from 'react-icons/ri';
import { Button } from '../Button';
import { getWorkflowEventIcon } from '../../../shared/workflowEventIcons';
import {
  useWorkflowMentionModalViewModel,
  type WorkflowMentionModalProps,
} from './WorkflowMentionModal.viewmodel';
import { S } from './WorkflowMentionModal.styles';

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  background: ${({ theme }) => theme.colors.overlay};
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: ${({ theme }) => theme.spacing.md};
  backdrop-filter: blur(4px);
  animation: fadeIn 150ms ease;
  @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
`;

const Container = styled.div`
  background: ${({ theme }) => theme.colors.surface};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.borderRadius.lg};
  width: 100%;
  max-width: 680px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 24px 64px ${({ theme }) => theme.colors.shadow};
  animation: slideUp 200ms ease;
  @keyframes slideUp { from { transform: translateY(12px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
`;

const Header = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${({ theme }) => theme.spacing.xl};
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  flex-shrink: 0;
`;

const Title = styled.h2`
  font-size: ${({ theme }) => theme.fontSizes.xl};
  font-weight: 600;
  color: ${({ theme }) => theme.colors.text};
`;

const CloseBtn = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  color: ${({ theme }) => theme.colors.textSecondary};
  transition: all ${({ theme }) => theme.transitions.fast};
  &:hover { background: ${({ theme }) => theme.colors.surfaceHover}; color: ${({ theme }) => theme.colors.text}; }
`;

const Content = styled.div`
  padding: ${({ theme }) => theme.spacing.xl};
  overflow-y: auto;
  flex: 1;
`;

export const WorkflowMentionModal: React.FC<WorkflowMentionModalProps> = (props) => {
  const vm = useWorkflowMentionModalViewModel(props);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); props.onClose(); }
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [props]);

  return (
    <Overlay onClick={(e) => e.target === e.currentTarget && props.onClose()}>
      <Container>
        <Header>
          <Title>Inserir Automação</Title>
          <CloseBtn onClick={props.onClose}><RiCloseLine size={20} /></CloseBtn>
        </Header>

        <Content>
          <S.FilterBar>
            <S.KeywordInput
              placeholder="Nome ou evento da automação..."
              value={vm.keyword}
              onChange={(e) => vm.setKeyword(e.target.value)}
              autoFocus
            />
          </S.FilterBar>

          {vm.items.length === 0 ? (
            <S.EmptyState>Nenhuma automação encontrada.</S.EmptyState>
          ) : (
            <S.CardList>
              {vm.items.map((w) => {
                const Icon = getWorkflowEventIcon(w.eventName);
                return (
                  <S.PickerCard key={w.id} onClick={() => vm.handleSelect(w)}>
                    <S.PickerIcon><Icon size={18} /></S.PickerIcon>
                    <S.PickerInfo>
                      <S.WorkflowName>{w.name}</S.WorkflowName>
                      <S.WorkflowEvent>{vm.getEventLabel(w.eventName)}</S.WorkflowEvent>
                    </S.PickerInfo>
                  </S.PickerCard>
                );
              })}
            </S.CardList>
          )}

          <S.Footer>
            <Button variant="secondary" onClick={props.onClose}>Cancelar</Button>
          </S.Footer>
        </Content>
      </Container>
    </Overlay>
  );
};
