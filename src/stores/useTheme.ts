import { createContext, useContext } from 'react';
import { AUTOMATIC_THEME } from '../domain/schema/theme';

/** Um tema como a lista o mostra: a identidade e o rótulo, sem a paleta. */
export interface ThemeOption {
  id: string;
  /** Referência de mensagem ou texto literal — quem renderiza resolve com `useLabel()`. */
  name: string;
  /** De que lado ele nasce, para a lista poder desenhar sol ou lua sem ler cor nenhuma. */
  base: 'dark' | 'light';
  /** A cor de destaque e a de fundo já resolvidas, para a amostra ao lado do nome. */
  primaryColor: string;
  backgroundColor: string;
}

export interface ThemeContextValue {
  /** O tema EM VIGOR, já negociado. Nunca é `automatic`. */
  themeId: string;
  /** O que está gravado na preferência: um id, `automatic`, ou `null` quando ninguém escolheu. */
  preferred: string | null;
  available: ThemeOption[];
  setTheme: (id: string) => void;
}

export { AUTOMATIC_THEME };

export const ThemeContext = createContext<ThemeContextValue | null>(null);

export const useTheme = (): ThemeContextValue => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
};
