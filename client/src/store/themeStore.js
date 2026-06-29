import { create } from 'zustand';
import { getThemePreference, setThemePreference } from '../utils/clientStorage.js';

const getInitialTheme = () => {
  if (typeof window === 'undefined') return 'system';
  return getThemePreference();
};

const getResolvedTheme = preference => {
  if (preference !== 'system') return preference;
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

const useThemeStore = create(set => {
  const preference = getInitialTheme();
  return {
    preference,
    resolvedTheme: getResolvedTheme(preference),
    setPreference: nextPreference => {
      setThemePreference(nextPreference);
      set({
        preference: nextPreference,
        resolvedTheme: getResolvedTheme(nextPreference),
      });
    },
    syncSystemTheme: () => set(state => ({
      resolvedTheme: getResolvedTheme(state.preference),
    })),
  };
});

export default useThemeStore;
