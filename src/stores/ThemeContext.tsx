import React, { useState } from 'react';
import { ThemeProvider as StyledThemeProvider } from 'styled-components';
import { darkTheme, lightTheme, claudeTheme, teamsTheme, brumaTheme, kindleTheme, curatinoTheme, themisTheme, themisDarkTheme } from '../shared/styles/theme';
import type { Theme } from '../shared/styles/theme';
import { GlobalStyles } from '../shared/styles/GlobalStyles';
import type { ThemeMode } from '../shared/types';
import { ThemeContext } from './useTheme';

const STORAGE_KEY = 'curatino-theme';

const THEMES: Record<ThemeMode, Theme> = {
  dark: darkTheme,
  light: lightTheme,
  claude: claudeTheme,
  teams: teamsTheme,
  bruma: brumaTheme,
  kindle: kindleTheme,
  curatino: curatinoTheme,
  themis: themisTheme,
  themisDark: themisDarkTheme,
};

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mode, setMode] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && saved in THEMES) return saved as ThemeMode;
    return 'curatino';
  });

  const theme: Theme = THEMES[mode] ?? darkTheme;

  const setTheme = (newMode: ThemeMode) => {
    localStorage.setItem(STORAGE_KEY, newMode);
    setMode(newMode);
  };

  const toggleTheme = () => {
    setTheme(mode === 'dark' ? 'light' : 'dark');
  };

  return (
    <ThemeContext.Provider value={{ mode, toggleTheme, setTheme }}>
      <StyledThemeProvider theme={theme}>
        <GlobalStyles />
        {children}
      </StyledThemeProvider>
    </ThemeContext.Provider>
  );
};
