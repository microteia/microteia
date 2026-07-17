import styled from 'styled-components';

// Casca (header/abas/ações) vive em components/layout/EntityDetailView. Aqui só o que é
// específico desta tela: os estados de indisponibilidade/não-encontrado e o corpo do formulário.
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
    gap: ${({ theme }) => theme.spacing.md};
    padding: ${({ theme }) => theme.spacing.lg} ${({ theme }) => theme.spacing.xl};
    border-bottom: 1px solid ${({ theme }) => theme.colors.border};
    flex-shrink: 0;
  `,

  Title: styled.h1`
    font-size: ${({ theme }) => theme.fontSizes.xl};
    font-weight: 700;
    color: ${({ theme }) => theme.colors.text};
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  `,

  FormWrapper: styled.div`
    max-width: 800px;
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.lg};
  `,

  BannerWrapper: styled.div`
    padding: ${({ theme }) => theme.spacing.lg} ${({ theme }) => theme.spacing.xl};
  `,

  SpinnerWrapper: styled.div`
    display: flex;
    justify-content: center;
    padding-top: ${({ theme }) => theme.spacing['2xl']};
  `,
};
