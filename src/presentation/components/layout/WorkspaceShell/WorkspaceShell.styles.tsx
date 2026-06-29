import styled from 'styled-components';

export const S = {
  Root: styled.div`
    display: flex;
    height: 100vh;
    overflow: hidden;
    background: ${({ theme }) => theme.colors.background};
  `,

  WorkspaceArea: styled.div`
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
    overflow: hidden;
  `,

  PanelArea: styled.div`
    flex: 1;
    display: flex;
    min-height: 0;
    overflow: hidden;
  `,

  ErrorBanner: styled.div`
    display: flex;
    align-items: center;
    justify-content: center;
    flex: 1;
    padding: 32px;
    color: ${({ theme }) => theme.colors.danger};
    font-size: 14px;
    text-align: center;
    flex-direction: column;
    gap: 8px;
  `,

  ErrorTitle: styled.p`
    font-weight: 600;
    font-size: 16px;
    color: ${({ theme }) => theme.colors.text};
  `,

  ErrorDetail: styled.p`
    font-size: 13px;
    color: ${({ theme }) => theme.colors.textMuted};
    max-width: 480px;
  `,
};
