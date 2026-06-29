import { useEffect } from 'react';
import useThemeStore from '../../store/themeStore.js';

export default function ThemeProvider({ children }) {
  const { preference, resolvedTheme, syncSystemTheme } = useThemeStore();

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', resolvedTheme === 'dark');
    root.dataset.theme = resolvedTheme;
    root.style.colorScheme = resolvedTheme;
  }, [resolvedTheme]);

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      if (preference === 'system') syncSystemTheme();
    };
    media.addEventListener('change', handleChange);
    return () => media.removeEventListener('change', handleChange);
  }, [preference, syncSystemTheme]);

  return children;
}
