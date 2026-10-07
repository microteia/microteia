import { styled } from 'styled-components';

/** Every colour, size and space comes from the theme; only the dot takes the option's own colour. */
const Wrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.md};
`;

const Toolbar = styled.div`
  display: flex;
  justify-content: flex-end;
`;

const Line = styled.ol`
  list-style: none;
  margin: 0;
  padding: 0 0 0 ${({ theme }) => theme.spacing.lg};
  border-left: 2px solid ${({ theme }) => theme.colors.border};
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.md};
`;

const Item = styled.li`
  position: relative;
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.md};
`;

const Dot = styled.span<{ $color: string }>`
  position: absolute;
  left: calc(-${({ theme }) => theme.spacing.lg} - ${({ theme }) => theme.spacing.sm} / 2 - 1px);
  width: ${({ theme }) => theme.spacing.sm};
  height: ${({ theme }) => theme.spacing.sm};
  border-radius: 50%;
  background: ${({ $color }) => $color};
`;

const Body = styled.button<{ $done: boolean }>`
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: ${({ theme }) => theme.spacing.xs};
  background: transparent;
  border: none;
  padding: 0;
  cursor: pointer;
  text-align: left;
  opacity: ${({ $done }) => ($done ? 0.6 : 1)};
`;

const Title = styled.span<{ $done: boolean }>`
  font-size: ${({ theme }) => theme.fontSizes.md};
  color: ${({ theme }) => theme.colors.text};
  text-decoration: ${({ $done }) => ($done ? 'line-through' : 'none')};
`;

const When = styled.span`
  font-size: ${({ theme }) => theme.fontSizes.sm};
  color: ${({ theme }) => theme.colors.textSecondary};
`;

const Actions = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing.xs};
`;

const Empty = styled.p`
  margin: 0;
  color: ${({ theme }) => theme.colors.textSecondary};
  font-size: ${({ theme }) => theme.fontSizes.sm};
`;

export const S = { Wrapper, Toolbar, Line, Item, Dot, Body, Title, When, Actions, Empty };
