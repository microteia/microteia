import { styled } from 'styled-components';

/**
 * Every colour, size, space and radius comes from the theme. A day that is not a business day uses
 * the theme's danger pair, a weekday that is never one uses the muted text — the grid has to read the
 * same in a light and a dark theme.
 */
const Missing = styled.div`
  padding: ${({ theme }) => theme.spacing.lg};
`;

const Layout = styled.div`
  display: grid;
  grid-template-columns: minmax(200px, 260px) 1fr;
  gap: ${({ theme }) => theme.spacing.lg};
  align-items: start;

  @media (max-width: 900px) {
    grid-template-columns: 1fr;
  }
`;

const Panel = styled.div`
  background: ${({ theme }) => theme.colors.surface};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.borderRadius.lg};
  padding: ${({ theme }) => theme.spacing.md};
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.md};
  min-width: 0;
`;

const PanelTitle = styled.div`
  font-size: ${({ theme }) => theme.fontSizes.sm};
  font-weight: 600;
  color: ${({ theme }) => theme.colors.textSecondary};
`;

const CalendarList = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.xs};
`;

const CalendarItem = styled.button<{ $active?: boolean }>`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  width: 100%;
  text-align: left;
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  border: 1px solid ${({ $active, theme }) => ($active ? theme.colors.primary : 'transparent')};
  background: ${({ $active, theme }) => ($active ? theme.colors.primaryLight : 'transparent')};
  color: ${({ theme }) => theme.colors.text};
  cursor: pointer;

  &:hover {
    background: ${({ $active, theme }) => ($active ? theme.colors.primaryLight : theme.colors.cardHover)};
  }
`;

const CalendarName = styled.span`
  font-size: ${({ theme }) => theme.fontSizes.sm};
  font-weight: 600;
`;

const CalendarKey = styled.span`
  font-family: ${({ theme }) => theme.fonts.mono};
  font-size: ${({ theme }) => theme.fontSizes.xs};
  color: ${({ theme }) => theme.colors.textMuted};
`;

const Muted = styled.div`
  font-size: ${({ theme }) => theme.fontSizes.sm};
  color: ${({ theme }) => theme.colors.textMuted};
`;

const FieldRow = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: ${({ theme }) => theme.spacing.md};

  @media (max-width: 640px) {
    grid-template-columns: 1fr;
  }
`;

const Field = styled.label`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.xs};
  font-size: ${({ theme }) => theme.fontSizes.xs};
  color: ${({ theme }) => theme.colors.textSecondary};
`;

const Hint = styled.span`
  font-size: ${({ theme }) => theme.fontSizes.xs};
  color: ${({ theme }) => theme.colors.textMuted};
`;

const Row = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
`;

const RowLabel = styled.span`
  font-size: ${({ theme }) => theme.fontSizes.xs};
  color: ${({ theme }) => theme.colors.textSecondary};
  margin-right: ${({ theme }) => theme.spacing.xs};
`;

const Chip = styled.button<{ $active?: boolean }>`
  padding: ${({ theme }) => theme.spacing.xs} ${({ theme }) => theme.spacing.sm};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  border: 1px solid ${({ $active, theme }) => ($active ? theme.colors.primary : theme.colors.border)};
  background: ${({ $active, theme }) => ($active ? theme.colors.primary : 'transparent')};
  color: ${({ $active, theme }) => ($active ? theme.colors.white : theme.colors.text)};
  font-size: ${({ theme }) => theme.fontSizes.xs};
  cursor: pointer;

  &:disabled {
    cursor: default;
    opacity: 0.6;
  }
`;

const Spacer = styled.div`
  flex: 1;
`;

const Months = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: ${({ theme }) => theme.spacing.md};
  user-select: none;
`;

const Month = styled.div`
  border: 1px solid ${({ theme }) => theme.colors.borderSubtle};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  padding: ${({ theme }) => theme.spacing.sm};
`;

const MonthName = styled.div`
  font-size: ${({ theme }) => theme.fontSizes.sm};
  font-weight: 600;
  text-transform: capitalize;
  color: ${({ theme }) => theme.colors.text};
  margin-bottom: ${({ theme }) => theme.spacing.xs};
`;

const Week = styled.div`
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 2px;
`;

const WeekdayHead = styled.div`
  text-align: center;
  font-size: ${({ theme }) => theme.fontSizes.xs};
  color: ${({ theme }) => theme.colors.textMuted};
`;

const Day = styled.button<{ $state: 'off' | 'weekend' | 'business'; $editable?: boolean }>`
  aspect-ratio: 1;
  border: none;
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  font-size: ${({ theme }) => theme.fontSizes.xs};
  touch-action: none;
  cursor: ${({ $state, $editable }) => ($editable && $state !== 'weekend' ? 'pointer' : 'default')};
  background: ${({ $state, theme }) =>
    $state === 'off' ? theme.colors.danger : $state === 'weekend' ? theme.colors.surfaceHover : 'transparent'};
  color: ${({ $state, theme }) =>
    $state === 'off' ? theme.colors.white : $state === 'weekend' ? theme.colors.textMuted : theme.colors.text};

  &:hover {
    outline: ${({ $state, $editable, theme }) =>
      $editable && $state !== 'weekend' ? `1px solid ${theme.colors.primary}` : 'none'};
  }
`;

const EmptyDay = styled.div``;

const LegendSwatch = styled.span<{ $state: 'off' | 'weekend' }>`
  display: inline-block;
  width: 12px;
  height: 12px;
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  background: ${({ $state, theme }) => ($state === 'off' ? theme.colors.danger : theme.colors.surfaceHover)};
`;

const LegendItem = styled.span`
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.xs};
  font-size: ${({ theme }) => theme.fontSizes.xs};
  color: ${({ theme }) => theme.colors.textSecondary};
`;

export const S = {
  Missing,
  Layout,
  Panel,
  PanelTitle,
  CalendarList,
  CalendarItem,
  CalendarName,
  CalendarKey,
  Muted,
  FieldRow,
  Field,
  Hint,
  Row,
  RowLabel,
  Chip,
  Spacer,
  Months,
  Month,
  MonthName,
  Week,
  WeekdayHead,
  Day,
  EmptyDay,
  LegendSwatch,
  LegendItem,
};
