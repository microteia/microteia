import styled from 'styled-components';

const Container = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.lg};
`;

const SaveRow = styled.div`
  display: flex;
  justify-content: flex-end;
  padding-top: ${({ theme }) => theme.spacing.md};
  border-top: 1px solid ${({ theme }) => theme.colors.border};
`;

const LogoRow = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.md};
  padding: ${({ theme }) => theme.spacing.md};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  border: 1px solid ${({ theme }) => theme.colors.border};
  background: ${({ theme }) => theme.colors.surface};
  flex-wrap: wrap;
`;

const LogoBox = styled.div`
  width: 56px;
  height: 56px;
  border-radius: ${({ theme }) => theme.borderRadius.md};
  background: ${({ theme }) => theme.colors.surfaceHover};
  color: ${({ theme }) => theme.colors.textMuted};
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  flex-shrink: 0;
`;

const LogoImg = styled.img`
  width: 100%;
  height: 100%;
  object-fit: contain;
`;

const LogoText = styled.div`
  flex: 1;
  min-width: 200px;
`;

const LogoTitle = styled.div`
  font-size: ${({ theme }) => theme.fontSizes.sm};
  font-weight: 600;
  color: ${({ theme }) => theme.colors.text};
`;

const LogoHint = styled.div`
  font-size: ${({ theme }) => theme.fontSizes.xs};
  color: ${({ theme }) => theme.colors.textMuted};
  margin-top: 2px;
  line-height: 1.45;
`;

const LogoError = styled.div`
  font-size: ${({ theme }) => theme.fontSizes.xs};
  color: ${({ theme }) => theme.colors.danger};
  margin-top: ${({ theme }) => theme.spacing.xs};
`;

const LogoActions = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing.xs};
`;

const HiddenInput = styled.input`
  display: none;
`;

export const S = {
  Container,
  SaveRow,
  LogoRow,
  LogoBox,
  LogoImg,
  LogoText,
  LogoTitle,
  LogoHint,
  LogoError,
  LogoActions,
  HiddenInput,
};
