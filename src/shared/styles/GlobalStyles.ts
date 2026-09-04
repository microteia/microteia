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
    line-height: 1.5;
    letter-spacing: -0.011em;
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
    border-radius: ${({ theme }) => theme.borderRadius.md};
    padding: 6px 14px;
    font-size: ${({ theme }) => theme.fontSizes.sm};
    transition: all ${({ theme }) => theme.transitions.fast};

    &:hover {
      background: ${({ theme }) => theme.colors.surfaceHover};
      color: ${({ theme }) => theme.colors.text};
    }

    &.rbc-active {
      background: ${({ theme }) => theme.colors.primary};
      color: ${({ theme }) => theme.colors.white};
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
    border-bottom: 1px solid ${({ theme }) => theme.colors.borderSubtle};
  }

  .rbc-month-view, .rbc-time-view, .rbc-agenda-view {
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.borderRadius.md};
    overflow: hidden;
  }

  .rbc-month-row {
    border-top: 1px solid ${({ theme }) => theme.colors.borderSubtle};
  }

  .rbc-day-bg {
    border-left: 1px solid ${({ theme }) => theme.colors.borderSubtle};
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
      border-bottom: 1px solid ${({ theme }) => theme.colors.borderSubtle};
      background: ${({ theme }) => theme.colors.surface};
    }

    tbody tr td {
      padding: 10px 16px;
      border-bottom: 1px solid ${({ theme }) => theme.colors.borderSubtle};
      font-size: ${({ theme }) => theme.fontSizes.sm};
      color: ${({ theme }) => theme.colors.text};
    }

    .rbc-agenda-date-cell, .rbc-agenda-time-cell {
      white-space: nowrap;
      color: ${({ theme }) => theme.colors.textSecondary};
    }
  }

  .rbc-time-header {
    border-bottom: 1px solid ${({ theme }) => theme.colors.borderSubtle};
  }

  .rbc-time-content {
    border-top: 1px solid ${({ theme }) => theme.colors.borderSubtle};
  }

  .rbc-timeslot-group {
    border-bottom: 1px solid ${({ theme }) => theme.colors.borderSubtle};
  }

  .rbc-time-slot {
    border-top: 1px solid ${({ theme }) => theme.colors.borderSubtle};
  }

  .rbc-label {
    color: ${({ theme }) => theme.colors.textMuted};
    font-size: ${({ theme }) => theme.fontSizes.xs};
  }

  .rbc-current-time-indicator {
    background: ${({ theme }) => theme.colors.primary};
  }

  /*
   * A FOLHA DE IMPRESSÃO.
   *
   * O navegador já sabe compor uma página e oferecer "Salvar como PDF" — trazer um gerador de PDF
   * custaria uma dependência, o embutimento de fontes e um segundo motor de layout, para produzir
   * algo pior. O que falta é dizer o que imprimir: tudo é escondido e só a marca data-print-root
   * reaparece, no lugar da página.
   *
   * As cores são forçadas para tinta em papel branco: um relatório impresso com o fundo do tema
   * escuro gasta o cartucho e sai ilegível.
   */
  @media print {
    body * {
      visibility: hidden;
    }

    [data-print-root],
    [data-print-root] * {
      visibility: visible;
    }

    [data-print-root] {
      position: absolute;
      inset: 0;
      width: 100%;
      padding: 0;
      background: #ffffff;
      color: #000000;
    }

    [data-print-root] table,
    [data-print-root] th,
    [data-print-root] td {
      background: #ffffff;
      color: #000000;
      border-color: #999999;
    }

    /* Uma linha partida entre duas páginas some do meio: o leitor não sabe que ela existiu. */
    [data-print-root] tr {
      break-inside: avoid;
    }

    [data-print-root] [data-print-hide] {
      display: none;
    }

    @page {
      margin: 14mm;
    }
  }
`;