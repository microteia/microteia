import { styled } from 'styled-components';

/**
 * Every colour, size, space and radius comes from the theme. The tag pill is the exception the rule
 * expects: its colour is DATA — whatever the office picked for that tag — and arrives as a `$` prop.
 */
const Card = styled.article`
  background: ${({ theme }) => theme.colors.surface};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-left-width: 3px;
  border-left-color: ${({ $isRead, theme }) => ($isRead ? theme.colors.border : theme.colors.primary)};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  padding: ${({ theme }) => theme.spacing.md};
  opacity: ${({ $isRead }) => ($isRead ? 0.75 : 1)};
  transition: opacity ${({ theme }) => theme.transitions.fast},
              box-shadow ${({ theme }) => theme.transitions.fast},
              border-left-color ${({ theme }) => theme.transitions.fast};
  cursor: pointer;

  &:hover {
    box-shadow: 0 2px 8px ${({ theme }) => theme.colors.shadow};
    opacity: 1;
  }
`;

const CardBody = styled.div`
  display: flex;
  align-items: flex-start;
  gap: ${({ theme }) => theme.spacing.md};
`;

const AvatarColumn = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  width: 44px;
  flex-shrink: 0;
`;

const AuthorName = styled.span`
  font-size: 10px;
  font-weight: 500;
  color: ${({ theme }) => theme.colors.textSecondary};
  text-align: center;
  line-height: 1.3;
  width: 44px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  display: block;
`;

const ContentColumn = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.sm};
`;

const TitleLine = styled.div`
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing.sm};
`;

const Title = styled.h3`
  font-size: ${({ theme }) => theme.fontSizes.md};
  font-weight: 600;
  color: ${({ theme }) => theme.colors.text};
  margin: 0;
  line-height: 1.4;
  flex: 1;
  min-width: 0;
  word-break: break-word;
`;

const DateText = styled.span`
  font-size: ${({ theme }) => theme.fontSizes.xs};
  color: ${({ theme }) => theme.colors.textMuted};
  white-space: nowrap;
  flex-shrink: 0;
`;

const MetaRow = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  flex-wrap: wrap;
`;

const MetaSpacer = styled.span`
  flex: 1;
`;

const CategoryBadge = styled.span`
  font-size: ${({ theme }) => theme.fontSizes.xs};
  font-weight: 600;
  background: ${({ theme }) => theme.colors.primaryLight};
  color: ${({ theme }) => theme.colors.primary};
  border-radius: ${({ theme }) => theme.borderRadius.full};
  padding: 2px 8px;
  letter-spacing: 0.03em;
`;

const UnreadBadge = styled.span`
  font-size: ${({ theme }) => theme.fontSizes.xs};
  font-weight: 600;
  background: ${({ theme }) => theme.colors.primaryLight};
  color: ${({ theme }) => theme.colors.primary};
  border-radius: ${({ theme }) => theme.borderRadius.full};
  padding: 2px 8px;
  border: 1px solid ${({ theme }) => theme.colors.primary};
`;

const EditedText = styled.span`
  font-size: ${({ theme }) => theme.fontSizes.xs};
  color: ${({ theme }) => theme.colors.textMuted};
  font-style: italic;
  line-height: 1.3;
`;

const Summary = styled.p`
  font-size: ${({ theme }) => theme.fontSizes.sm};
  color: ${({ theme }) => theme.colors.textSecondary};
  margin: 0;
  line-height: 1.6;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
`;

const TagsRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.spacing.xs};
`;

const TagPill = styled.span`
  font-size: ${({ theme }) => theme.fontSizes.xs};
  background: ${({ $color }) => $color}33;
  color: ${({ $color }) => $color};
  border-radius: ${({ theme }) => theme.borderRadius.full};
  padding: 2px 8px;
  font-weight: 500;
`;

const FooterRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: ${({ theme }) => theme.spacing.xs};
  padding-top: ${({ theme }) => theme.spacing.xs};
  border-top: 1px solid ${({ theme }) => theme.colors.border};
`;

const Stats = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.md};
`;

const StatItem = styled.button`
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: ${({ theme }) => theme.fontSizes.xs};
  color: ${({ theme, $active }) => ($active ? theme.colors.primary : theme.colors.textMuted)};
  background: none;
  border: none;
  cursor: pointer;
  padding: 2px 4px;
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  transition: color ${({ theme }) => theme.transitions.fast};

  &:hover { color: ${({ theme }) => theme.colors.primary}; }
`;

const StatDisplay = styled.span`
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: ${({ theme }) => theme.fontSizes.xs};
  color: ${({ theme }) => theme.colors.textMuted};
  padding: 2px 4px;
`;

const Actions = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.xs};
`;

const IconBtn = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  border: none;
  background: none;
  cursor: pointer;
  color: ${({ theme, $active }) => ($active ? theme.colors.primary : theme.colors.textMuted)};
  transition: color ${({ theme }) => theme.transitions.fast},
              background ${({ theme }) => theme.transitions.fast};

  &:hover {
    background: ${({ theme }) => theme.colors.surfaceHover};
    color: ${({ theme }) => theme.colors.primary};
  }
`;

// A counter is ROUND with one digit and becomes a pill with two. Equal height and min-width, with the
// text centred by flex itself: in a span of running text the vertical spacing does not push the box
// out, and the dot comes out squashed.
const HeaderCount = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  border-radius: ${({ theme }) => theme.borderRadius.full};
  background: ${({ theme }) => theme.colors.danger};
  color: ${({ theme }) => theme.colors.white};
  font-size: ${({ theme }) => theme.fontSizes.xs};
  font-weight: 700;
  line-height: 1;
`;

const Missing = styled.div`
  padding: ${({ theme }) => theme.spacing.lg};
`;

/**
 * An action that is a switch (it declares activeWhen) shows the record's state by colour: on in
 * success, off in danger - the same reading as the record header.
 */
const ToggleIcon = styled.span<{ $on: boolean }>`
  display: inline-flex;
  color: ${({ $on, theme }) => ($on ? theme.colors.success : theme.colors.danger)};
`;

export const S = {
  Missing,
  Card,
  CardBody,
  AvatarColumn,
  AuthorName,
  ContentColumn,
  TitleLine,
  Title,
  DateText,
  MetaRow,
  MetaSpacer,
  CategoryBadge,
  UnreadBadge,
  EditedText,
  Summary,
  TagsRow,
  TagPill,
  FooterRow,
  Stats,
  StatItem,
  StatDisplay,
  Actions,
  IconBtn,
  HeaderCount,
  ToggleIcon,
};
