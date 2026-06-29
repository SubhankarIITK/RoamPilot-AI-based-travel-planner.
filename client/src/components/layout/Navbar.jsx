import { Link, useNavigate } from 'react-router-dom';
import useAuthStore from '../../store/authStore.js';
import useBillingStore from '../../store/billingStore.js';
import ThemeToggle from '../common/ThemeToggle.jsx';

export default function Navbar() {
  const { user, logout } = useAuthStore();
  const creditBalance = useBillingStore(state => state.summary?.subscription?.creditBalance);
  const creditExempt = useBillingStore(state => state.summary?.creditExempt);
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
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
    <nav className="sticky top-0 z-50 flex min-h-16 items-center justify-between border-b border-slate-200/80 bg-white/90 px-4 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-[#080d19]/90">
      <Link to="/dashboard" className="flex items-center gap-2.5" aria-label="RoamPilot dashboard">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-md">
          ◇
        </span>
        <span className="text-lg font-bold tracking-tight text-slate-900">RoamPilot</span>
      </Link>
      <div className="flex items-center gap-1">
        <Link to="/billing" className="mr-1 rounded-lg bg-indigo-50 px-2.5 py-2 text-xs font-bold text-indigo-700">
          {creditExempt ? '∞ admin' : `${creditBalance ?? 0} credits`}
        </Link>
        <ThemeToggle className="mr-1" />
        <Link to="/dashboard" className="rounded-lg px-2.5 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-blue-700">
          Trips
        </Link>
        <Link to="/notifications" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-blue-700" aria-label="Notifications">
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path strokeLinecap="round" strokeLinejoin="round" d="M14.86 17.08A23.85 23.85 0 0 0 18 16.5c-1.5-1.75-2.25-3.75-2.25-6a3.75 3.75 0 1 0-7.5 0c0 2.25-.75 4.25-2.25 6 1.02.28 2.07.47 3.14.58m5.72 0a3 3 0 0 1-5.72 0" />
          </svg>
        </Link>
        <Link
          to="/settings"
          className="ml-1 grid h-9 w-9 place-items-center rounded-full bg-blue-100 text-xs font-bold text-blue-700 ring-2 ring-white"
          title={user?.name || 'Settings'}
        >
          {initials}
        </Link>
        <button
          type="button"
          onClick={handleLogout}
          className="ml-1 rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"
          aria-label="Log out"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15M12 9l3-3m-3 3 3 3m0-3H9" />
          </svg>
        </button>
      </div>
    </nav>
  );
}
