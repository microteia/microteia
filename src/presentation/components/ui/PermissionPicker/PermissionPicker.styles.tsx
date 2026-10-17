import styled from 'styled-components';
import { Input } from '../Input';

const Container = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.sm};
`;

const Toolbar = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing.sm};
  flex-wrap: wrap;
`;

const Search = styled(Input)`
  flex: 1 1 12rem;
  min-width: 0;
`;

const Count = styled.span`
  font-size: ${({ theme }) => theme.fontSizes.xs};
  color: ${({ theme }) => theme.colors.textSecondary};
`;

const Actions = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.xs};
  margin-left: auto;

  svg {
    font-size: ${({ theme }) => theme.fontSizes.sm};
    color: ${({ theme }) => theme.colors.primary};
  }
`;

const List = styled.div`
  display: flex;
  flex-direction: column;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  max-height: 20rem;
  overflow-y: auto;
`;

const Group = styled.div`
  & + & {
    border-top: 1px solid ${({ theme }) => theme.colors.border};
  }
`;

const GroupHeader = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md};
  background: ${({ theme }) => theme.colors.surfaceHover};
`;

const Disclosure = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: none;
  padding: 0;
  cursor: pointer;
  color: ${({ theme }) => theme.colors.textSecondary};
  font-size: ${({ theme }) => theme.fontSizes.md};
  line-height: 1;

  &:hover {
    color: ${({ theme }) => theme.colors.primary};
  }
`;

const GroupCount = styled.span`
  margin-left: auto;
  font-size: ${({ theme }) => theme.fontSizes.xs};
  color: ${({ theme }) => theme.colors.textSecondary};
  white-space: nowrap;
`;

const Rows = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.xs};
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md};
`;

const Row = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding-left: ${({ theme }) => theme.spacing.lg};
`;

const RowNote = styled.span<{ $warning?: boolean }>`
  padding-left: ${({ theme }) => theme.spacing.lg};
  font-size: ${({ theme }) => theme.fontSizes.xs};
  line-height: 1.4;
  color: ${({ theme, $warning }) => ($warning ? theme.colors.warning : theme.colors.textSecondary)};
`;

const Empty = styled.div`
  padding: ${({ theme }) => theme.spacing.md};
  font-size: ${({ theme }) => theme.fontSizes.sm};
  color: ${({ theme }) => theme.colors.textSecondary};
  text-align: center;
`;

export const S = {
  Container,
  Toolbar,
  Search,
  Count,
  Actions,
  List,
  Group,
  GroupHeader,
  Disclosure,
  GroupCount,
  Rows,
  Row,
  RowNote,
  Empty,
};
