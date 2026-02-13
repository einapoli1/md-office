import { useState, useEffect } from 'react';

export type Theme = 'light' | 'dark' | 'system';

export const useTheme = () => {
  // Get initial theme from localStorage or default to 'system'
  const [theme, setTheme] = useState<Theme>(() => {
    const stored = localStorage.getItem('theme') as Theme;
    return stored || 'system';
  });

  // Get the actual applied theme (resolving 'system')
  const [appliedTheme, setAppliedTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    const body = document.body;

    // Remove existing theme classes
    body.classList.remove('light', 'dark');

    if (theme === 'system') {
      // Use system preference
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const systemTheme = prefersDark ? 'dark' : 'light';
      setAppliedTheme(systemTheme);
    } else {
      // Use explicitly set theme
      setAppliedTheme(theme);
      body.classList.add(theme);
    }
  }, [theme]);

  useEffect(() => {
    // Listen for system theme changes when in system mode
    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      
      const handleChange = (e: MediaQueryListEvent) => {
        setAppliedTheme(e.matches ? 'dark' : 'light');
      };

      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
  }, [theme]);

  const setAndStoreTheme = (newTheme: Theme) => {
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
  };

  const toggleTheme = () => {
    const nextTheme = appliedTheme === 'light' ? 'dark' : 'light';
    setAndStoreTheme(nextTheme);
  };

  return {
    theme,
    appliedTheme,
    setTheme: setAndStoreTheme,
    toggleTheme,
    isDark: appliedTheme === 'dark',
  };
};