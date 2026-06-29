import styled from 'styled-components';

export const S = {
  Page: styled.div`
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
  `,

  Header: styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: ${({ theme }) => theme.spacing.lg} ${({ theme }) => theme.spacing.xl};
    border-bottom: 1px solid ${({ theme }) => theme.colors.border};
    flex-shrink: 0;
  `,

  Title: styled.h1`
    font-size: ${({ theme }) => theme.fontSizes.xl};
    font-weight: 700;
    color: ${({ theme }) => theme.colors.text};
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

    &:hover { color: ${({ theme }) => theme.colors.text}; }
  `,

  Content: styled.div`
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: ${({ theme }) => theme.spacing.lg} ${({ theme }) => theme.spacing.xl};
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.xl};
  `,

  Section: styled.div`
    background: ${({ theme }) => theme.colors.surface};
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.borderRadius.lg};
    overflow: visible;
  `,

  SectionHeader: styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.spacing.lg};
    border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  `,

  SectionTitle: styled.h2`
    font-size: ${({ theme }) => theme.fontSizes.md};
    font-weight: 600;
    color: ${({ theme }) => theme.colors.text};
  `,

  SectionBody: styled.div`
    padding: ${({ theme }) => theme.spacing.lg};
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.md};
  `,

  FormGrid: styled.div`
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: ${({ theme }) => theme.spacing.md};
    @media (max-width: 600px) { grid-template-columns: 1fr; }
  `,

  FormGroup: styled.div<{ $fullWidth?: boolean }>`
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.xs};
    grid-column: ${({ $fullWidth }) => $fullWidth ? '1 / -1' : 'auto'};
  `,

  MemberList: styled.div`
    display: flex;
    flex-direction: column;
  `,

  MemberRow: styled.div`
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.md};
    padding: ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.spacing.lg};
    border-bottom: 1px solid ${({ theme }) => theme.colors.border};
    &:last-child { border-bottom: none; }
  `,

  Avatar: styled.div`
    width: 36px;
    height: 36px;
    border-radius: ${({ theme }) => theme.borderRadius.full};
    background: ${({ theme }) => theme.colors.primaryLight};
    color: ${({ theme }) => theme.colors.primary};
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    font-size: ${({ theme }) => theme.fontSizes.sm};
    flex-shrink: 0;
    overflow: hidden;

    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
  `,

  MemberInfo: styled.div`
    flex: 1;
    min-width: 0;
  `,

  MemberName: styled.div`
    font-size: ${({ theme }) => theme.fontSizes.sm};
    font-weight: 600;
    color: ${({ theme }) => theme.colors.text};
  `,

  MemberEmail: styled.div`
    font-size: ${({ theme }) => theme.fontSizes.xs};
    color: ${({ theme }) => theme.colors.textMuted};
  `,

  MemberActions: styled.div`
    display: flex;
    gap: ${({ theme }) => theme.spacing.sm};
    align-items: center;
  `,

  AddMemberRow: styled.div`
    display: grid;
    grid-template-columns: 1fr auto auto;
    gap: ${({ theme }) => theme.spacing.sm};
    align-items: end;
    padding: ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.spacing.lg};
    border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  `,

  SaveRow: styled.div`
    display: flex;
    justify-content: flex-end;
    padding-top: ${({ theme }) => theme.spacing.md};
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

  AIFormGroup: styled.div`
    display: flex;
    flex-direction: column;
    gap: 6px;
  `,

  AILabel: styled.label`
    font-size: ${({ theme }) => theme.fontSizes.sm};
    font-weight: 500;
    color: ${({ theme }) => theme.colors.textSecondary};
  `,

  AIInput: styled.input`
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

  Feedback: styled.div<{ $type: 'success' | 'error' }>`
    font-size: ${({ theme }) => theme.fontSizes.sm};
    color: ${({ theme, $type }) => ($type === 'success' ? theme.colors.success : theme.colors.danger)};
  `,

  AIAddRow: styled.div`
    align-self: flex-start;
  `,
};
