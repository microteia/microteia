import React, { useEffect } from 'react';
import styled from 'styled-components';
import { RiCloseLine } from 'react-icons/ri';
import { Button } from '../Button';
import {
  useContractMentionModalViewModel,
  type ContractMentionModalProps,
} from './ContractMentionModal.viewmodel';
import { S } from './ContractMentionModal.styles';

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

export const ContractMentionModal: React.FC<ContractMentionModalProps> = (props) => {
  const vm = useContractMentionModalViewModel(props);

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
          <Title>Inserir Contrato</Title>
          <CloseBtn onClick={props.onClose}><RiCloseLine size={20} /></CloseBtn>
        </Header>

        <Content>
          <S.FilterBar>
            <S.KeywordInput
              placeholder="Número ou título do contrato..."
              value={vm.keyword}
              onChange={(e) => vm.setKeyword(e.target.value)}
              autoFocus
            />
          </S.FilterBar>

          {vm.items.length === 0 ? (
            <S.EmptyState>Nenhum contrato encontrado.</S.EmptyState>
          ) : (
            <S.CardList>
              {vm.items.map((c) => (
                <S.PickerCard key={c.id} onClick={() => vm.handleSelect(c)}>
                  <S.ContractTitle>{c.title}</S.ContractTitle>
                  <S.ContractMeta>
                    <S.ContractNumber>{c.number}</S.ContractNumber>
                  </S.ContractMeta>
                </S.PickerCard>
              ))}
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
