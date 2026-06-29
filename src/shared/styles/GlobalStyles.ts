import { createGlobalStyle } from 'styled-components';

export const GlobalStyles = createGlobalStyle`
  *, *::before, *::after {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }

  html {
    font-size: 16px;
    scroll-behavior: smooth;
  }

  body {
    font-family: ${({ theme }) => theme.fonts.body};
    background-color: ${({ theme }) => theme.colors.background};
    color: ${({ theme }) => theme.colors.text};
    line-height: 1.6;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    transition: background-color ${({ theme }) => theme.transitions.normal},
                color ${({ theme }) => theme.transitions.normal};
  }

  ::-webkit-scrollbar {
    width: 6px;
    height: 6px;
  }

  ::-webkit-scrollbar-track {
    background: ${({ theme }) => theme.colors.scrollbar};
  }

  ::-webkit-scrollbar-thumb {
    background: ${({ theme }) => theme.colors.scrollbarThumb};
    border-radius: ${({ theme }) => theme.borderRadius.full};
  }

  a {
    color: inherit;
    text-decoration: none;
  }

  button {
    cursor: pointer;
    border: none;
    background: none;
    font-family: inherit;
  }

  input, textarea, select {
    font-family: inherit;
    font-size: inherit;
  }

  ul, ol {
    list-style: none;
  }

  /* React Big Calendar overrides */
  .rbc-calendar {
    background: transparent;
    color: ${({ theme }) => theme.colors.text};
    font-family: ${({ theme }) => theme.fonts.body};
  }

  .rbc-toolbar {
    margin-bottom: 16px;
    flex-wrap: wrap;
    gap: 8px;
  }

  .rbc-toolbar button {
    color: ${({ theme }) => theme.colors.textSecondary};
    background: ${({ theme }) => theme.colors.surface};
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.borderRadius.sm};
    padding: 6px 14px;
    font-size: ${({ theme }) => theme.fontSizes.sm};
    transition: all ${({ theme }) => theme.transitions.fast};

    &:hover {
      background: ${({ theme }) => theme.colors.surfaceHover};
      color: ${({ theme }) => theme.colors.text};
    }

    &.rbc-active {
      background: ${({ theme }) => theme.colors.primary};
      color: #fff;
      border-color: ${({ theme }) => theme.colors.primary};
      box-shadow: none;

      &:hover {
        background: ${({ theme }) => theme.colors.primaryHover};
      }
    }
  }

  .rbc-toolbar-label {
    font-weight: 600;
    font-size: ${({ theme }) => theme.fontSizes.lg};
    color: ${({ theme }) => theme.colors.text};
  }

  .rbc-header {
    padding: 10px 0;
    font-size: ${({ theme }) => theme.fontSizes.sm};
    font-weight: 500;
    color: ${({ theme }) => theme.colors.textSecondary};
    border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  }

  .rbc-month-view, .rbc-time-view, .rbc-agenda-view {
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.borderRadius.md};
    overflow: hidden;
  }

  .rbc-month-row {
    border-top: 1px solid ${({ theme }) => theme.colors.border};
  }

  .rbc-day-bg {
    border-left: 1px solid ${({ theme }) => theme.colors.border};
    transition: background ${({ theme }) => theme.transitions.fast};

    &:hover {
      background: ${({ theme }) => theme.colors.surfaceHover};
    }
  }

  .rbc-today {
    background: ${({ theme }) => theme.colors.calendarToday} !important;
  }

  .rbc-off-range-bg {
    background: ${({ theme }) => theme.colors.background};
  }

  .rbc-date-cell {
    padding: 6px 8px;
    font-size: ${({ theme }) => theme.fontSizes.sm};
    color: ${({ theme }) => theme.colors.textSecondary};

    &.rbc-now {
      font-weight: 700;
      color: ${({ theme }) => theme.colors.primary};
    }

    &.rbc-off-range {
      color: ${({ theme }) => theme.colors.textMuted};
    }
  }

  .rbc-event {
    background: ${({ theme }) => theme.colors.primary};
    border: none !important;
    border-radius: ${({ theme }) => theme.borderRadius.sm};
    padding: 2px 6px;
    font-size: ${({ theme }) => theme.fontSizes.xs};
    font-weight: 500;
    cursor: pointer;
    transition: opacity ${({ theme }) => theme.transitions.fast};

    &:hover {
      opacity: 0.85;
    }
  }

  .rbc-event-label {
    display: none;
  }

  .rbc-show-more {
    color: ${({ theme }) => theme.colors.primary};
    font-size: ${({ theme }) => theme.fontSizes.xs};
    font-weight: 500;
    background: transparent;
    padding: 2px 6px;
  }

  .rbc-agenda-table {
    border: none;

    thead tr th {
      padding: 10px 16px;
      font-size: ${({ theme }) => theme.fontSizes.sm};
      font-weight: 500;
      color: ${({ theme }) => theme.colors.textSecondary};
      border-bottom: 1px solid ${({ theme }) => theme.colors.border};
      background: ${({ theme }) => theme.colors.surface};
    }

    tbody tr td {
      padding: 10px 16px;
      border-bottom: 1px solid ${({ theme }) => theme.colors.border};
      font-size: ${({ theme }) => theme.fontSizes.sm};
      color: ${({ theme }) => theme.colors.text};
    }

    .rbc-agenda-date-cell, .rbc-agenda-time-cell {
      white-space: nowrap;
      color: ${({ theme }) => theme.colors.textSecondary};
    }
  }

  .rbc-time-header {
    border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  }

  .rbc-time-content {
    border-top: 1px solid ${({ theme }) => theme.colors.border};
  }

  .rbc-timeslot-group {
    border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  }

  .rbc-time-slot {
    border-top: 1px solid ${({ theme }) => theme.colors.border};
  }

  .rbc-label {
    color: ${({ theme }) => theme.colors.textMuted};
    font-size: ${({ theme }) => theme.fontSizes.xs};
  }

  .rbc-current-time-indicator {
    background: ${({ theme }) => theme.colors.primary};
  }
`;
