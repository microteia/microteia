import styled from 'styled-components';

// Casca (header/abas/ações) vive em components/layout/EntityDetailView. Aqui só o corpo do
// formulário de Pessoa e o ícone do toggle de status (ação específica desta tela).
export const S = {
  ToggleIcon: styled.span<{ $enabled: boolean }>`
    display: inline-flex;
    color: ${({ $enabled, theme }) => ($enabled ? theme.colors.success : theme.colors.danger)};
  `,

  FormGrid: styled.div`
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: ${({ theme }) => theme.spacing.md};
    max-width: 800px;

    @media (max-width: 640px) {
      grid-template-columns: 1fr;
    }
  `,

  FormGroup: styled.div<{ $fullWidth?: boolean }>`
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.xs};
    grid-column: ${({ $fullWidth }) => $fullWidth ? '1 / -1' : 'auto'};
  `,

  SectionTitle: styled.h3`
    font-size: ${({ theme }) => theme.fontSizes.md};
    font-weight: 600;
    color: ${({ theme }) => theme.colors.text};
    margin: ${({ theme }) => theme.spacing.lg} 0 ${({ theme }) => theme.spacing.sm};
    padding-bottom: ${({ theme }) => theme.spacing.xs};
    border-bottom: 1px solid ${({ theme }) => theme.colors.border};
    grid-column: 1 / -1;
  `,
};
