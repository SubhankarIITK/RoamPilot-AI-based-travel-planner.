import useThemeStore from '../../store/themeStore.js';

export default function ThemeToggle({ className = '' }) {
  const { resolvedTheme, setPreference } = useThemeStore();
  const isDark = resolvedTheme === 'dark';

  return (
    <button
      type="button"
      onClick={() => setPreference(isDark ? 'light' : 'dark')}
      className={`grid h-9 w-9 place-items-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:border-blue-300 hover:text-blue-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white ${className}`}
      aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
      title={`Switch to ${isDark ? 'light' : 'dark'} mode`}
    >
      {isDark ? (
        <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <circle cx="12" cy="12" r="3.5" />
          <path strokeLinecap="round" d="M12 2.5v2M12 19.5v2M4.5 12h-2M21.5 12h-2M5.28 5.28 3.86 3.86m16.28 16.28-1.42-1.42m0-13.44 1.42-1.42M3.86 20.14l1.42-1.42" />
        </svg>
      ) : (
        <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path strokeLinecap="round" strokeLinejoin="round" d="M20.3 15.2A8.5 8.5 0 0 1 8.8 3.7 8.5 8.5 0 1 0 20.3 15.2Z" />
        </svg>
      )}
    </button>
  );
}
