import { createContext, useContext, useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'campuscart-theme';
const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  // index.html has already chosen the theme before the first paint.
  const [theme, setTheme] = useState(() => document.documentElement.getAttribute('data-theme') || 'dark');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const value = useMemo(
    () => ({
      theme,
      toggleTheme: () => {
        const next = theme === 'dark' ? 'light' : 'dark';
        setTheme(next);
        try {
          localStorage.setItem(STORAGE_KEY, next);
        } catch {
          // The theme still applies for this visit.
        }
      },
    }),
    [theme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
