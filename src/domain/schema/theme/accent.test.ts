import { describe, expect, it } from 'vitest';
import { applyAccent } from './accent';
import type { ThemeShape } from './themeSpec';

const shape = (base: ThemeShape['base']): ThemeShape => ({
  id: base,
  base,
  colors: { primary: '#f56b3a', primaryHover: '#d45a2a', primaryLight: 'x', calendarToday: 'x', danger: '#cc4a31' },
  fonts: { body: 'Geist' },
  fontSizes: {},
  spacing: {},
  borderRadius: {},
  transitions: {},
  sidebar: {},
  highlights: {},
  tagColors: [],
});

const baseDarkTheme = shape('dark');
const baseLightTheme = shape('light');

describe('applyAccent', () => {
  it('troca o destaque e os três tokens derivados dele, sem tocar o resto', () => {
    const themed = applyAccent(baseDarkTheme, '#1f6feb');
    expect(themed.colors.primary).toBe('#1f6feb');
    expect(themed.colors.primaryHover).toBe('#1b61cc');
    expect(themed.colors.primaryLight).toBe('rgba(31, 111, 235, 0.15)');
    expect(themed.colors.calendarToday).toBe('rgba(31, 111, 235, 0.14)');
    expect(themed.colors.danger).toBe(baseDarkTheme.colors.danger);
    expect(themed.fonts).toBe(baseDarkTheme.fonts);
  });

  it('usa a transparência do lado claro no tema claro', () => {
    const themed = applyAccent(baseLightTheme, '#1f6feb');
    expect(themed.colors.primaryLight).toBe('rgba(31, 111, 235, 0.1)');
    expect(themed.colors.calendarToday).toBe('rgba(31, 111, 235, 0.1)');
  });

  it('não muta o tema recebido', () => {
    const before = baseDarkTheme.colors.primary;
    applyAccent(baseDarkTheme, '#000000');
    expect(baseDarkTheme.colors.primary).toBe(before);
  });
});
