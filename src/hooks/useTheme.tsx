import { useState, useEffect } from 'react';

type Theme = 'dark' | 'light' | 'system';

// Safe localStorage access helper
const safeLocalStorage = {
  getItem(key: string, fallback: string = ''): string {
    try {
      return localStorage.getItem(key) || fallback;
    } catch (error) {
      console.warn('Error accessing localStorage:', error);
      return fallback;
    }
  },
  setItem(key: string, value: string): void {
    try {
      localStorage.setItem(key, value);
    } catch (error) {
      console.warn('Error setting localStorage:', error);
    }
  }
};

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(
    () => (safeLocalStorage.getItem('theme', 'system') as Theme) || 'system'
  );

  useEffect(() => {
    const root = window.document.documentElement;
    
    root.classList.remove('light', 'dark');
    
    if (theme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light';
      
      root.classList.add(systemTheme);
      return;
    }
    
    root.classList.add(theme);
  }, [theme]);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const handleChange = () => {
      if (theme === 'system') {
        const root = window.document.documentElement;
        root.classList.remove('light', 'dark');
        root.classList.add(mediaQuery.matches ? 'dark' : 'light');
      }
    };
    
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme]);

  useEffect(() => {
    safeLocalStorage.setItem('theme', theme);
  }, [theme]);

  return { theme, setTheme };
}
