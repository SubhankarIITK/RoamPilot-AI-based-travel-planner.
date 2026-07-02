import { Link, useNavigate } from 'react-router-dom';
import useAuthStore from '../../store/authStore.js';
import useBillingStore from '../../store/billingStore.js';
import ThemeToggle from '../common/ThemeToggle.jsx';

export default function Navbar({ onMenuClick }) {
  const { user, logout } = useAuthStore();
  const creditBalance = useBillingStore(state => state.summary?.subscription?.creditBalance);
  const creditExempt = useBillingStore(state => state.summary?.creditExempt);
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const initials =
    user?.name
      ?.trim()
      .split(/\s+/)
      .slice(0, 2)
      .map(part => part[0])
      .join('')
      .toUpperCase() || 'RP';

  return (
    <nav className="sticky top-0 z-50 flex min-h-16 items-center justify-between gap-2 border-b border-emerald-100 bg-white/90 px-3 shadow-sm backdrop-blur-xl dark:border-emerald-300/10 dark:bg-[#03120f]/90 sm:px-4">
      <div className="flex min-w-0 items-center gap-1.5">
        <button
          type="button"
          onClick={onMenuClick}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-slate-600 transition hover:bg-emerald-50 hover:text-emerald-700 dark:text-slate-300 dark:hover:bg-white/[0.06] dark:hover:text-white"
          aria-label="Open navigation menu"
          aria-haspopup="dialog"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path strokeLinecap="round" d="M4 7h16M4 12h16M4 17h16" />
          </svg>
        </button>

        <Link to="/dashboard" className="flex min-w-0 items-center gap-2.5" aria-label="RoamPilot dashboard">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-emerald-500 to-lime-500 text-emerald-950 shadow-md">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <circle cx="12" cy="12" r="9" />
              <path strokeLinecap="round" strokeLinejoin="round" d="m14.8 9.2-1.9 3.7-3.7 1.9 1.9-3.7 3.7-1.9Z" />
            </svg>
          </span>
          <span className="hidden truncate text-lg font-bold tracking-tight text-slate-900 min-[380px]:block">
            RoamPilot
          </span>
        </Link>
      </div>

      <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
        <Link to="/billing" className="mr-0.5 rounded-lg bg-emerald-50 px-2 py-2 text-[11px] font-bold text-emerald-700 sm:mr-1 sm:px-2.5 sm:text-xs">
          <span className="hidden min-[430px]:inline">
            {creditExempt ? 'Unlimited admin' : `${creditBalance ?? 0} credits`}
          </span>
          <span className="min-[430px]:hidden" aria-label={creditExempt ? 'Unlimited admin credits' : `${creditBalance ?? 0} credits`}>
            {creditExempt ? '∞' : creditBalance ?? 0}
          </span>
        </Link>
        <ThemeToggle className="hidden sm:grid" />
        <Link to="/dashboard" className="hidden rounded-lg px-2.5 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-blue-700 sm:block">
          Trips
        </Link>
        <Link to="/notifications" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-blue-700" aria-label="Notifications">
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path strokeLinecap="round" strokeLinejoin="round" d="M14.86 17.08A23.85 23.85 0 0 0 18 16.5c-1.5-1.75-2.25-3.75-2.25-6a3.75 3.75 0 1 0-7.5 0c0 2.25-.75 4.25-2.25 6 1.02.28 2.07.47 3.14.58m5.72 0a3 3 0 0 1-5.72 0m5.72 0c-.92.11-1.88.17-2.86.17s-1.94-.06-2.86-.17" />
          </svg>
        </Link>
        <Link
          to="/settings"
          className="ml-0.5 grid h-9 w-9 place-items-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-700 ring-2 ring-white sm:ml-1"
          title={user?.name || 'Settings'}
        >
          {initials}
        </Link>
        <button type="button" onClick={handleLogout} className="sr-only" tabIndex={-1}>
          Log out
        </button>
      </div>
    </nav>
  );
}
