import type { ThemeShape } from './themeSpec';

const channels = (hex: string): [number, number, number] => [
  parseInt(hex.slice(1, 3), 16),
  parseInt(hex.slice(3, 5), 16),
  parseInt(hex.slice(5, 7), 16),
];

const toHex = (channel: number): string =>
  Math.max(0, Math.min(255, Math.round(channel))).toString(16).padStart(2, '0');

/** O mesmo escurecimento que separa `primary` de `primaryHover` nas duas bases do kernel. */
const HOVER_FACTOR = 0.87;

/**
 * Sobrepõe a cor de destaque da INSTALAÇÃO ao tema em vigor.
 *
 * Os três tokens derivados saem da mesma cor porque é assim que as duas bases os declaram — trocar só
 * `primary` deixava o botão laranja escurecer para o azul do tema claro ao passar o mouse. A
 * transparência dos realces segue a do lado do tema: o que é sutil no escuro some no claro.
 */
export const applyAccent = <T extends ThemeShape>(theme: T, accent: string): T => {
  const [red, green, blue] = channels(accent);
  const subtle = theme.base === 'light' ? 0.1 : 0.15;
  return {
    ...theme,
    colors: {
      ...theme.colors,
      primary: accent,
      primaryHover: `#${toHex(red * HOVER_FACTOR)}${toHex(green * HOVER_FACTOR)}${toHex(blue * HOVER_FACTOR)}`,
      primaryLight: `rgba(${red}, ${green}, ${blue}, ${subtle})`,
      calendarToday: `rgba(${red}, ${green}, ${blue}, ${theme.base === 'light' ? 0.1 : 0.14})`,
    },
  };
};
