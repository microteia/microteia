import React from 'react';
import styled from 'styled-components';
import { RiAlertLine, RiInformationLine } from 'react-icons/ri';
import { Button } from './Button';

type ConfirmVariant = 'danger' | 'default';

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  background: ${({ theme }) => theme.colors.overlay};
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
  padding: ${({ theme }) => theme.spacing.md};
  backdrop-filter: blur(4px);
  animation: fadeIn 150ms ease;
  @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
`;

const Box = styled.div`
  background: ${({ theme }) => theme.colors.surface};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.borderRadius.lg};
  padding: ${({ theme }) => theme.spacing.xl};
  width: 100%;
  max-width: 400px;
  box-shadow: 0 24px 64px ${({ theme }) => theme.colors.shadow};
  animation: slideUp 200ms ease;
  @keyframes slideUp {
    from { transform: translateY(12px); opacity: 0; }
    to   { transform: translateY(0); opacity: 1; }
  }
`;

const IconRow = styled.div<{ $variant: ConfirmVariant }>`
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: ${({ $variant }) =>
    $variant === 'danger' ? 'rgba(239,68,68,0.12)' : 'rgba(108,99,255,0.12)'};
  color: ${({ $variant }) => $variant === 'danger' ? '#ef4444' : '#6c63ff'};
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: ${({ theme }) => theme.spacing.md};
`;

const Title = styled.h3`
  font-size: ${({ theme }) => theme.fontSizes.lg};
  font-weight: 600;
  color: ${({ theme }) => theme.colors.text};
  margin-bottom: ${({ theme }) => theme.spacing.sm};
`;

const Message = styled.p`
  font-size: ${({ theme }) => theme.fontSizes.sm};
  color: ${({ theme }) => theme.colors.textSecondary};
  line-height: 1.6;
  margin-bottom: ${({ theme }) => theme.spacing.md};
`;

const Input = styled.input`
  width: 100%;
  padding: 9px 12px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  background: ${({ theme }) => theme.colors.inputBackground};
  color: ${({ theme }) => theme.colors.text};
  font-size: ${({ theme }) => theme.fontSizes.sm};
  margin-bottom: ${({ theme }) => theme.spacing.xl};
  outline: none;
  &:focus { border-color: ${({ theme }) => theme.colors.primary}; }
`;

const Actions = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing.sm};
  justify-content: flex-end;
`;

export interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ConfirmVariant;
  loading?: boolean;
  inputValue?: string;
  inputPlaceholder?: string;
  onInputChange?: (value: string) => void;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  variant = 'default',
  loading = false,
  inputValue,
  inputPlaceholder,
  onInputChange,
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  return (
    <Overlay onClick={(e) => e.target === e.currentTarget && onCancel()}>
      <Box>
        <IconRow $variant={variant}>
          {variant === 'danger'
            ? <RiAlertLine size={24} />
            : <RiInformationLine size={24} />}
        </IconRow>
        <Title>{title}</Title>
        <Message>{message}</Message>
        {onInputChange !== undefined && (
          <Input
            value={inputValue ?? ''}
            onChange={(e) => onInputChange(e.target.value)}
            placeholder={inputPlaceholder}
            autoFocus
          />
        )}
        <Actions>
          <Button variant="secondary" onClick={onCancel} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button
            variant={variant === 'danger' ? 'danger' : 'primary'}
            onClick={onConfirm}
            $isLoading={loading}
            disabled={loading}
          >
            {confirmLabel}
          </Button>
        </Actions>
      </Box>
    </Overlay>
  );
};
