import React, { useCallback } from 'react';
import styled from 'styled-components';
import { RiCloseLine, RiCheckLine } from 'react-icons/ri';

import { useT } from '../../shared/i18n/useT';
interface ImageCropModalProps {
  imageSrc: string;
  onCrop: (blob: Blob) => Promise<void>;
  onClose: () => void;
}

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
`;

const Container = styled.div`
  background: ${({ theme }) => theme.colors.surface};
  border-radius: ${({ theme }) => theme.borderRadius.xl};
  padding: ${({ theme }) => theme.spacing.xl};
  width: 420px;
  max-width: 90vw;
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.lg};
`;

const Header = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const Title = styled.h3`
  font-size: ${({ theme }) => theme.fontSizes.lg};
  font-weight: 600;
  color: ${({ theme }) => theme.colors.text};
  margin: 0;
`;

const CloseBtn = styled.button`
  background: none;
  border: none;
  color: ${({ theme }) => theme.colors.textMuted};
  cursor: pointer;
  padding: 4px;
  display: flex;
  align-items: center;
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  &:hover { color: ${({ theme }) => theme.colors.text}; }
`;

const PreviewImg = styled.img`
  width: 200px;
  height: 200px;
  object-fit: cover;
  border-radius: 50%;
  display: block;
  margin: 0 auto;
  border: 3px solid ${({ theme }) => theme.colors.border};
`;

const Actions = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing.sm};
  justify-content: flex-end;
`;

const Btn = styled.button<{ $primary?: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border-radius: ${({ theme }) => theme.borderRadius.md};
  font-size: ${({ theme }) => theme.fontSizes.sm};
  font-weight: 500;
  cursor: pointer;
  border: 1px solid ${({ $primary, theme }) => $primary ? theme.colors.primary : theme.colors.border};
  background: ${({ $primary, theme }) => $primary ? theme.colors.primary : 'transparent'};
  color: ${({ $primary, theme }) => $primary ? '#fff' : theme.colors.text};
  transition: opacity ${({ theme }) => theme.transitions.fast};
  &:hover { opacity: 0.85; }
`;

export const ImageCropModal: React.FC<ImageCropModalProps> = ({ imageSrc, onCrop, onClose }) => {
  const t = useT('core.ui');
  const handleConfirm = useCallback(async () => {
    const res = await fetch(imageSrc);
    const blob = await res.blob();
    await onCrop(blob);
  }, [imageSrc, onCrop]);

  return (
    <Overlay onClick={(e) => e.target === e.currentTarget && onClose()}>
      <Container>
        <Header>
          <Title>{t('image.confirm-title')}</Title>
          <CloseBtn onClick={onClose}><RiCloseLine size={20} /></CloseBtn>
        </Header>
        <PreviewImg src={imageSrc} alt={t('image.preview')} />
        <Actions>
          <Btn onClick={onClose}>{t('action.cancel')}</Btn>
          <Btn $primary onClick={handleConfirm}>
            <RiCheckLine size={16} />
            {t('image.use')}
          </Btn>
        </Actions>
      </Container>
    </Overlay>
  );
};
