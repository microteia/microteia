import styled from 'styled-components';

export const S = {
  Page: styled.div`
    display: flex;
    flex-direction: column;
    height: 100%;
    background: ${({ theme }) => theme.colors.background};
  `,

  PageHeader: styled.div`
    padding: ${({ theme }) => theme.spacing.xl} ${({ theme }) => theme.spacing.xl} 0;
    flex-shrink: 0;
  `,

  PageTitle: styled.h1`
    font-size: ${({ theme }) => theme.fontSizes['2xl']};
    font-weight: 700;
    color: ${({ theme }) => theme.colors.text};
    margin-bottom: ${({ theme }) => theme.spacing.lg};
  `,

  TabsBar: styled.div`
    display: flex;
    border-bottom: 1px solid ${({ theme }) => theme.colors.border};
    padding: 0 ${({ theme }) => theme.spacing.xl};
    gap: 2px;
    flex-shrink: 0;
  `,

  Tab: styled.button<{ $active: boolean }>`
    padding: 12px 20px;
    font-size: ${({ theme }) => theme.fontSizes.sm};
    font-weight: 500;
    color: ${({ theme, $active }) => ($active ? theme.colors.primary : theme.colors.textSecondary)};
    border-bottom: 2px solid ${({ theme, $active }) => ($active ? theme.colors.primary : 'transparent')};
    background: transparent;
    margin-bottom: -1px;
    transition: all ${({ theme }) => theme.transitions.fast};

    &:hover {
      color: ${({ theme }) => theme.colors.text};
    }
  `,

  Content: styled.div`
    flex: 1;
    overflow-y: auto;
    padding: ${({ theme }) => theme.spacing.xl};
  `,

  Section: styled.div`
    background: ${({ theme }) => theme.colors.surface};
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.borderRadius.lg};
    padding: ${({ theme }) => theme.spacing.xl};
    margin-bottom: ${({ theme }) => theme.spacing.lg};
    max-width: 680px;
  `,

  SectionTitle: styled.h2`
    font-size: ${({ theme }) => theme.fontSizes.md};
    font-weight: 600;
    color: ${({ theme }) => theme.colors.text};
    margin-bottom: ${({ theme }) => theme.spacing.lg};
    padding-bottom: ${({ theme }) => theme.spacing.sm};
    border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  `,

  AvatarRow: styled.div`
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.lg};
    margin-bottom: ${({ theme }) => theme.spacing.xl};
  `,

  AvatarWrapper: styled.div`
    position: relative;
    flex-shrink: 0;
  `,

  Avatar: styled.div`
    width: 96px;
    height: 96px;
    border-radius: 50%;
    overflow: hidden;
    border: 3px solid ${({ theme }) => theme.colors.primary};
    background: ${({ theme }) => theme.colors.inputBackground};
    display: flex;
    align-items: center;
    justify-content: center;
  `,

  AvatarImg: styled.img`
    width: 100%;
    height: 100%;
    object-fit: cover;
  `,

  AvatarInitial: styled.div`
    font-size: ${({ theme }) => theme.fontSizes['2xl']};
    font-weight: 700;
    color: ${({ theme }) => theme.colors.primary};
  `,

  AvatarUploadBadge: styled.div`
    position: absolute;
    bottom: 2px;
    right: 2px;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: ${({ theme }) => theme.colors.primary};
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    border: 2px solid ${({ theme }) => theme.colors.surface};

    &:hover { background: ${({ theme }) => theme.colors.primaryHover}; }
  `,

  AvatarRemoveBadge: styled.div`
    position: absolute;
    top: 2px;
    right: 2px;
    width: 22px;
    height: 22px;
    border-radius: 50%;
    background: ${({ theme }) => theme.colors.danger};
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    border: 2px solid ${({ theme }) => theme.colors.surface};
    opacity: 0.85;
    transition: opacity ${({ theme }) => theme.transitions.fast};

    &:hover { opacity: 1; }
  `,

  AvatarIdentity: styled.div`
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.sm};
    justify-content: center;
  `,

  AvatarIdentityItem: styled.div`
    display: flex;
    flex-direction: column;
    gap: 2px;
  `,

  AvatarIdentityLabel: styled.span`
    font-size: ${({ theme }) => theme.fontSizes.xs};
    color: ${({ theme }) => theme.colors.textMuted};
    text-transform: uppercase;
    letter-spacing: 0.04em;
  `,

  AvatarIdentityValue: styled.span`
    font-size: ${({ theme }) => theme.fontSizes.sm};
    color: ${({ theme }) => theme.colors.text};
    font-weight: 500;
  `,

  PhotoError: styled.div`
    font-size: ${({ theme }) => theme.fontSizes.xs};
    color: ${({ theme }) => theme.colors.danger};
    margin-top: ${({ theme }) => theme.spacing.xs};
  `,

  FormGrid: styled.div`
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: ${({ theme }) => theme.spacing.md};

    @media (max-width: 560px) { grid-template-columns: 1fr; }
  `,

  FormGroup: styled.div`
    display: flex;
    flex-direction: column;
    gap: 6px;
  `,

  FormGroupFull: styled.div`
    display: flex;
    flex-direction: column;
    gap: 6px;
    grid-column: 1 / -1;
  `,

  Label: styled.label`
    font-size: ${({ theme }) => theme.fontSizes.sm};
    font-weight: 500;
    color: ${({ theme }) => theme.colors.textSecondary};
  `,

  Input: styled.input`
    width: 100%;
    padding: 10px 14px;
    background: ${({ theme }) => theme.colors.inputBackground};
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.borderRadius.md};
    color: ${({ theme }) => theme.colors.text};
    font-size: ${({ theme }) => theme.fontSizes.sm};
    transition: border-color ${({ theme }) => theme.transitions.fast};

    &:focus {
      outline: none;
      border-color: ${({ theme }) => theme.colors.primary};
    }

    &::placeholder { color: ${({ theme }) => theme.colors.textMuted}; }
  `,

  ReadonlyInput: styled.div`
    padding: 10px 14px;
    background: ${({ theme }) => theme.colors.inputBackground};
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.borderRadius.md};
    color: ${({ theme }) => theme.colors.textMuted};
    font-size: ${({ theme }) => theme.fontSizes.sm};
    opacity: 0.7;
  `,

  FormActions: styled.div`
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.sm};
    margin-top: ${({ theme }) => theme.spacing.lg};
    padding-top: ${({ theme }) => theme.spacing.lg};
    border-top: 1px solid ${({ theme }) => theme.colors.border};
  `,

  Feedback: styled.div<{ $type: 'success' | 'error' }>`
    font-size: ${({ theme }) => theme.fontSizes.sm};
    color: ${({ theme, $type }) => ($type === 'success' ? theme.colors.success : theme.colors.danger)};
  `,

  AIList: styled.div`
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.sm};
    margin-bottom: ${({ theme }) => theme.spacing.lg};
  `,

  AICard: styled.div<{ $isDefault?: boolean }>`
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.md};
    padding: ${({ theme }) => theme.spacing.md};
    background: ${({ theme }) => theme.colors.inputBackground};
    border: 1px solid ${({ theme, $isDefault }) => ($isDefault ? theme.colors.primary : theme.colors.border)};
    border-radius: ${({ theme }) => theme.borderRadius.md};
    transition: border-color ${({ theme }) => theme.transitions.fast};

    &:hover { border-color: ${({ theme }) => theme.colors.primary}; }
  `,

  AIProviderIcon: styled.div<{ $color: string }>`
    width: 40px;
    height: 40px;
    border-radius: ${({ theme }) => theme.borderRadius.sm};
    background: ${({ $color }) => $color};
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    font-weight: 700;
    font-size: 1rem;
    flex-shrink: 0;
  `,

  AICardBody: styled.div`
    flex: 1;
    min-width: 0;
  `,

  AICardName: styled.div`
    font-size: ${({ theme }) => theme.fontSizes.sm};
    font-weight: 600;
    color: ${({ theme }) => theme.colors.text};
    display: flex;
    align-items: center;
    gap: 8px;
  `,

  AICardMeta: styled.div`
    font-size: ${({ theme }) => theme.fontSizes.xs};
    color: ${({ theme }) => theme.colors.textMuted};
    margin-top: 2px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  `,

  DefaultBadge: styled.span`
    font-size: ${({ theme }) => theme.fontSizes.xs};
    font-weight: 500;
    color: ${({ theme }) => theme.colors.primary};
    background: ${({ theme }) => theme.colors.primaryLight};
    padding: 2px 8px;
    border-radius: ${({ theme }) => theme.borderRadius.full};
  `,

  AICardActions: styled.div`
    display: flex;
    gap: 4px;
    flex-shrink: 0;
  `,

  EmptyState: styled.div`
    text-align: center;
    padding: ${({ theme }) => theme.spacing.xl};
    color: ${({ theme }) => theme.colors.textMuted};
    font-size: ${({ theme }) => theme.fontSizes.sm};
  `,

  ModalOverlay: styled.div`
    position: fixed;
    inset: 0;
    background: ${({ theme }) => theme.colors.overlay};
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1500;
    padding: ${({ theme }) => theme.spacing.md};
    backdrop-filter: blur(4px);
    animation: fadeIn 150ms ease;
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
  `,

  ModalContainer: styled.div`
    background: ${({ theme }) => theme.colors.surface};
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.borderRadius.lg};
    width: 100%;
    max-width: 520px;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 24px 64px ${({ theme }) => theme.colors.shadow};
    animation: slideUp 200ms ease;
    @keyframes slideUp {
      from { transform: translateY(16px); opacity: 0; }
      to   { transform: translateY(0); opacity: 1; }
    }
  `,

  ModalHeader: styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: ${({ theme }) => theme.spacing.xl};
    border-bottom: 1px solid ${({ theme }) => theme.colors.border};
    flex-shrink: 0;
  `,

  ModalTitle: styled.h2`
    font-size: ${({ theme }) => theme.fontSizes.xl};
    font-weight: 600;
    color: ${({ theme }) => theme.colors.text};
  `,

  ModalContent: styled.div`
    padding: ${({ theme }) => theme.spacing.xl};
    overflow-y: auto;
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.md};
  `,

  ModalActions: styled.div`
    display: flex;
    gap: ${({ theme }) => theme.spacing.sm};
    justify-content: flex-end;
    padding: ${({ theme }) => theme.spacing.xl};
    border-top: 1px solid ${({ theme }) => theme.colors.border};
    flex-shrink: 0;
  `,

  PasswordRow: styled.div`
    position: relative;
    display: flex;
    align-items: center;
  `,

  PasswordInput: styled.input`
    width: 100%;
    padding: 10px 44px 10px 14px;
    background: ${({ theme }) => theme.colors.inputBackground};
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.borderRadius.md};
    color: ${({ theme }) => theme.colors.text};
    font-size: ${({ theme }) => theme.fontSizes.sm};
    font-family: ${({ theme }) => theme.fonts.mono};
    transition: border-color ${({ theme }) => theme.transitions.fast};

    &:focus {
      outline: none;
      border-color: ${({ theme }) => theme.colors.primary};
    }
  `,

  PasswordToggle: styled.button`
    position: absolute;
    right: 10px;
    color: ${({ theme }) => theme.colors.textMuted};
    display: flex;
    align-items: center;
    background: transparent;

    &:hover { color: ${({ theme }) => theme.colors.text}; }
  `,

  SliderRow: styled.div`
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.sm};
  `,

  Slider: styled.input`
    flex: 1;
    accent-color: ${({ theme }) => theme.colors.primary};
    cursor: pointer;
  `,

  SliderValue: styled.span`
    font-size: ${({ theme }) => theme.fontSizes.sm};
    color: ${({ theme }) => theme.colors.textSecondary};
    min-width: 36px;
    text-align: right;
  `,

  NicknameLockedRow: styled.div`
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.sm};
    padding: 10px 14px;
    background: ${({ theme }) => theme.colors.inputBackground};
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.borderRadius.md};
    color: ${({ theme }) => theme.colors.textSecondary};
    font-size: ${({ theme }) => theme.fontSizes.sm};
    opacity: 0.8;
  `,

  NicknameLockedValue: styled.span`
    font-weight: 600;
    color: ${({ theme }) => theme.colors.text};
    font-size: ${({ theme }) => theme.fontSizes.sm};
  `,

  NicknameStatusRow: styled.div`
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: 6px;
    min-height: 20px;
  `,

  NicknameStatusIcon: styled.span<{ $spin?: boolean }>`
    display: flex;
    align-items: center;
    ${({ $spin }) => $spin && `
      animation: nicknameIconSpin 0.8s linear infinite;
      @keyframes nicknameIconSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
    `}
  `,

  NicknameStatusText: styled.span<{ $status: string }>`
    font-size: ${({ theme }) => theme.fontSizes.xs};
    font-weight: 500;
    color: ${({ theme, $status }) => {
      if ($status === 'available') return theme.colors.success;
      if ($status === 'checking') return theme.colors.textMuted;
      return theme.colors.danger;
    }};
  `,

  NicknameHint: styled.p`
    font-size: ${({ theme }) => theme.fontSizes.xs};
    color: ${({ theme }) => theme.colors.textMuted};
    margin-top: 6px;
    line-height: 1.5;
  `,

  NicknameActions: styled.div`
    margin-top: ${({ theme }) => theme.spacing.md};
  `,

  NicknameCurrentBadge: styled.div`
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: ${({ theme }) => theme.fontSizes.xs};
    color: ${({ theme }) => theme.colors.textMuted};
    background: ${({ theme }) => theme.colors.inputBackground};
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.borderRadius.full};
    padding: 3px 10px;
    margin-bottom: ${({ theme }) => theme.spacing.sm};
  `,
};
