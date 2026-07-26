import React, { useEffect } from 'react';
import styled from 'styled-components';
import { Button } from './Button';
import { RiCloseLine, RiFullscreenLine, RiFullscreenExitLine } from 'react-icons/ri';

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

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
`;

const SIZE_WIDTHS = {
  small: '420px',
  medium: '640px',
  large: '800px',
  xlarge: '1040px',
} as const;

const Container = styled.div<{ $size: keyof typeof SIZE_WIDTHS; $maximized?: boolean }>`
  background: ${({ theme }) => theme.colors.surface};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ $maximized, theme }) => ($maximized ? '0' : theme.borderRadius.lg)};
  width: ${({ $maximized }) => ($maximized ? '100vw' : '100%')};
  max-width: ${({ $maximized, $size }) => ($maximized ? '100vw' : SIZE_WIDTHS[$size])};
  height: ${({ $maximized }) => ($maximized ? '100vh' : 'auto')};
  max-height: ${({ $maximized }) => ($maximized ? '100vh' : '90vh')};
  display: flex;
  flex-direction: column;
  animation: slideUp 200ms ease;
  box-shadow: 0 24px 64px ${({ theme }) => theme.colors.shadow};

  @keyframes slideUp {
    from { transform: translateY(16px); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
  }
`;

const Header = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${({ theme }) => theme.spacing.xl};
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  flex-shrink: 0;
`;

const HeaderActions = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.xs};
`;

const Content = styled.div`
  padding: ${({ theme }) => theme.spacing.xl};
  overflow-y: auto;
  flex: 1;
`;

const Title = styled.h2`
  font-size: ${({ theme }) => theme.fontSizes.xl};
  font-weight: 600;
  color: ${({ theme }) => theme.colors.text};
`;

const CloseButton = styled(Button)`
  padding: 6px;
  border-radius: ${({ theme }) => theme.borderRadius.sm};
`;

interface ModalProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  size?: keyof typeof SIZE_WIDTHS;
  maximizable?: boolean;
  maximized?: boolean;
  onToggleMaximize?: () => void;
}

export const Modal: React.FC<ModalProps> = ({ 
  title, 
  onClose, 
  children, 
  size = 'small',
  maximizable = false,
  maximized = false,
  onToggleMaximize,
}) => {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <Overlay onClick={(e) => e.target === e.currentTarget && onClose()}>
      <Container $size={size} $maximized={maximized}>
        <Header>
          <Title>{title}</Title>
          <HeaderActions>
            {maximizable && onToggleMaximize && (
              <CloseButton variant="ghost" onClick={onToggleMaximize} title={maximized ? 'Restaurar' : 'Maximizar'}>
                {maximized ? <RiFullscreenExitLine size={20} /> : <RiFullscreenLine size={20} />}
              </CloseButton>
            )}
            <CloseButton variant="ghost" onClick={onClose} title="Fechar">
              <RiCloseLine size={20} />
            </CloseButton>
          </HeaderActions>
        </Header>
        <Content>
          {children}
        </Content>
      </Container>
    </Overlay>
  );
};
