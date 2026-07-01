import { useEffect, useState } from 'react';
import { NavLink, useNavigate, useParams } from 'react-router-dom';
import useAuthStore from '../../store/authStore.js';
import useBillingStore from '../../store/billingStore.js';
import ThemeToggle from '../common/ThemeToggle.jsx';
import { getLatestTripPlanningProgress } from '../../api/aiApi.js';

const icons = {
  dashboard: 'M3 13h8V3H3v10Zm10 8h8V11h-8v10ZM3 21h8v-6H3v6Zm10-12h8V3h-8v6Z',
  add: 'M12 5v14m-7-7h14',
  profile: 'M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.5 20.1a7.5 7.5 0 0 1 15 0A17.9 17.9 0 0 1 12 21.75a17.9 17.9 0 0 1-7.5-1.65Z',
  offline: 'M12 3v12m0 0 4.5-4.5M12 15l-4.5-4.5M5 21h14',
  settings: 'M12 15.75a3.75 3.75 0 1 0 0-7.5 3.75 3.75 0 0 0 0 7.5Zm0-12.75v1.5m0 15V21M4.22 4.22l1.06 1.06m13.44 13.44 1.06 1.06M3 12h1.5m15 0H21M4.22 19.78l1.06-1.06M18.72 5.28l1.06-1.06',
  billing: 'M12 6v12m3-9.75H10.5a2.25 2.25 0 0 0 0 4.5h3a2.25 2.25 0 0 1 0 4.5H8.25M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
  overview: 'M3.75 5.25A2.25 2.25 0 0 1 6 3h12a2.25 2.25 0 0 1 2.25 2.25v13.5A2.25 2.25 0 0 1 18 21H6a2.25 2.25 0 0 1-2.25-2.25V5.25ZM8 7.5h8M8 12h8m-8 4.5h5',
  planner: 'm15.75 4.5-1.5 3.75L18 6.75l-3.75 1.5 1.5 3.75 1.5-3.75L21 6.75l-3.75-1.5-1.5-3.75ZM7.5 12l-1.25 3.25L3 16.5l3.25 1.25L7.5 21l1.25-3.25L12 16.5l-3.25-1.25L7.5 12Zm3-9-1 2.5L7 6.5l2.5 1 1 2.5 1-2.5 2.5-1-2.5-1-1-2.5Z',
  chat: 'M8.6 18.6 4.5 21v-4.9A8.25 8.25 0 1 1 8.6 18.6ZM8.25 10.5h.01m3.74 0h.01m3.74 0h.01',
  bookings: 'M3.75 7.5h16.5M6 3.75v3.75m12-3.75v3.75M5.25 5.25h13.5A1.5 1.5 0 0 1 20.25 6.75v12a1.5 1.5 0 0 1-1.5 1.5H5.25a1.5 1.5 0 0 1-1.5-1.5v-12a1.5 1.5 0 0 1 1.5-1.5ZM8 12h3m2 0h3m-8 4h3m2 0h3',
  documents: 'M6.75 3h7.5L19.5 8.25v12A.75.75 0 0 1 18.75 21h-12A.75.75 0 0 1 6 20.25V3.75A.75.75 0 0 1 6.75 3Zm7.5 0v5.25h5.25M9 12h6m-6 3h6m-6 3h3',
  expenses: 'M12 6v12m3-9.75H10.5a2.25 2.25 0 0 0 0 4.5h3a2.25 2.25 0 0 1 0 4.5H8.25M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
  checklist: 'm4.5 7.5 1.5 1.5 3-3M4.5 12l1.5 1.5 3-3m-4.5 6L6 18l3-3m3-7.5h7.5M12 12h7.5M12 16.5h7.5',
  versions: 'M16.02 4.98A8.25 8.25 0 1 0 19.5 12m0-6v6h-6M12 7.5V12l3 1.5',
  emergency: 'M12 9v4.5m0 3h.01M10.3 3.84 2.8 17.1A2.25 2.25 0 0 0 4.76 20.5h14.48a2.25 2.25 0 0 0 1.96-3.4L13.7 3.84a1.96 1.96 0 0 0-3.4 0Z',
  notifications: 'M14.86 17.08A23.85 23.85 0 0 0 18 16.5c-1.5-1.75-2.25-3.75-2.25-6a3.75 3.75 0 1 0-7.5 0c0 2.25-.75 4.25-2.25 6 1.02.28 2.07.47 3.14.58m5.72 0a3 3 0 0 1-5.72 0m5.72 0c-.92.11-1.88.17-2.86.17s-1.94-.06-2.86-.17',
  memory: 'M4.5 5.25A2.25 2.25 0 0 1 6.75 3H18a1.5 1.5 0 0 1 1.5 1.5v15A1.5 1.5 0 0 1 18 21H6.75a2.25 2.25 0 0 1-2.25-2.25V5.25Zm0 0A2.25 2.25 0 0 0 6.75 7.5H19.5M8.25 11.25h7.5m-7.5 3h7.5',
  logout: 'M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15M12 9l3-3m-3 3 3 3m0-3H9',
};

function Icon({ name, solid = false }) {
  return (
    <svg
      aria-hidden="true"
      className="h-5 w-5 shrink-0"
      fill={solid ? 'currentColor' : 'none'}
      viewBox="0 0 24 24"
      stroke={solid ? 'none' : 'currentColor'}
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={icons[name]} />
    </svg>
  );
}

const mainLinks = [
  { to: '/dashboard', label: 'My Trips', icon: 'dashboard', end: true },
  { to: '/trips/new', label: 'Create Trip', icon: 'add', end: true },
  { to: '/profile', label: 'Travel Profile', icon: 'profile', end: true },
  { to: '/offline', label: 'Offline Trips', icon: 'offline', end: true },
  { to: '/notifications', label: 'Notifications', icon: 'notifications', end: true },
  { to: '/billing', label: 'Plans & Credits', icon: 'billing', end: true },
  { to: '/settings', label: 'Settings', icon: 'settings', end: true },
];

function navigationClass({ isActive }) {
  return [
    'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all duration-200',
    isActive
      ? 'bg-gradient-to-r from-emerald-400/20 to-lime-400/10 text-white shadow-[inset_0_0_0_1px_rgba(52,211,153,.2)]'
      : 'text-slate-400 hover:bg-white/[0.055] hover:text-white',
  ].join(' ');
}

export default function Sidebar({ className = '', onNavigate }) {
  const { id: tripId } = useParams();
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const billingSummary = useBillingStore(state => state.summary);
  const subscription = billingSummary?.subscription;
  const creditExempt = billingSummary?.creditExempt;
  const [planningStatus, setPlanningStatus] = useState(null);

  useEffect(() => {
    if (!tripId) {
      setPlanningStatus(null);
      return undefined;
    }
    let cancelled = false;
    const checkPlanning = async () => {
      try {
        const response = await getLatestTripPlanningProgress(tripId);
        if (!cancelled) setPlanningStatus(response.data.data.status);
      } catch (error) {
        if (!cancelled && error.response?.status === 404) setPlanningStatus(null);
      }
    };
    checkPlanning();
    const interval = window.setInterval(checkPlanning, 5000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [tripId]);

  const tripLinks = tripId
    ? [
        { to: `/trips/${tripId}`, label: 'Trip Overview', icon: 'overview', end: true },
        { to: `/trips/${tripId}/planner`, label: 'AI Planner', icon: 'planner', end: true },
        { to: `/trips/${tripId}/chat`, label: 'AI Chat', icon: 'chat', end: true },
        { to: `/trips/${tripId}/bookings`, label: 'Book & Compare', icon: 'bookings', end: true },
        { to: `/trips/${tripId}/documents`, label: 'Documents', icon: 'documents', end: true },
        { to: `/trips/${tripId}/expenses`, label: 'Expenses', icon: 'expenses', end: true },
        { to: `/trips/${tripId}/checklist`, label: 'Checklist', icon: 'checklist', end: true },
        { to: `/trips/${tripId}/versions`, label: 'Trip Versions', icon: 'versions', end: true },
        { to: `/trips/${tripId}/emergency`, label: 'Emergency', icon: 'emergency', end: true },
        { to: `/trips/${tripId}/memory`, label: 'Trip Memory', icon: 'memory', end: true },
      ]
    : [];

  const handleLogout = async () => {
    await logout();
    onNavigate?.();
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
    <aside
      aria-label="Application sidebar"
      className={`flex h-screen w-72 shrink-0 flex-col border-r border-emerald-300/10 bg-[#03120f]/[0.98] text-white shadow-[12px_0_40px_rgba(2,12,10,0.28)] backdrop-blur-xl ${className}`}
    >
      <div className="border-b border-white/[0.07] px-5 py-5">
        <NavLink
          to="/dashboard"
          onClick={onNavigate}
          className="flex items-center gap-3"
          aria-label="RoamPilot dashboard"
        >
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-emerald-400 via-green-500 to-lime-500 text-emerald-950 shadow-[0_10px_28px_rgba(16,185,129,0.25)] ring-1 ring-emerald-200/20">
            <svg
              aria-hidden="true"
              className="h-5 w-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="9" />
              <path d="m14.8 9.2-1.9 3.7-3.7 1.9 1.9-3.7 3.7-1.9Z" />
            </svg>
          </span>
          <span>
            <span className="block text-base font-extrabold tracking-tight text-white">RoamPilot</span>
            <span className="block text-[11px] font-medium text-slate-500">Travel intelligence</span>
          </span>
        </NavLink>
      </div>

      <nav className="flex-1 space-y-7 overflow-y-auto px-3 py-5">
        <div>
          <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-600">
            Plan
          </p>
          <div className="space-y-1">
            {mainLinks.map(link => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.end}
                onClick={onNavigate}
                className={navigationClass}
              >
                <Icon name={link.icon} solid={link.icon === 'dashboard'} />
                <span>{link.label}</span>
              </NavLink>
            ))}
          </div>
        </div>

        {tripLinks.length > 0 && (
          <div>
            <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-600">
              Current Trip
            </p>
            <div className="space-y-1">
              {tripLinks.map(link => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  end={link.end}
                  onClick={onNavigate}
                  className={navigationClass}
                >
                  <Icon name={link.icon} />
                  <span className="min-w-0 flex-1">{link.label}</span>
                  {link.icon === 'planner' && planningStatus === 'running' && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-400/15 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-emerald-300">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-300" />
                      Running
                    </span>
                  )}
                  {link.icon === 'planner' && planningStatus === 'failed' && (
                    <span className="rounded-full bg-amber-400/15 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-amber-300">
                      Resume
                    </span>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        )}
      </nav>

      <div className="border-t border-white/[0.07] bg-white/[0.018] p-3">
        <NavLink
          to="/billing"
          onClick={onNavigate}
          className="mb-2 flex items-center justify-between rounded-xl border border-emerald-300/10 bg-gradient-to-r from-emerald-400/10 to-lime-400/[0.05] px-3 py-2.5 transition hover:border-emerald-300/20 hover:bg-emerald-400/15"
        >
          <span>
            <span className="block text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-300">AI credits</span>
            <span className="mt-0.5 block text-sm font-extrabold text-white">
              {creditExempt ? 'Unlimited admin' : `${subscription?.creditBalance ?? 0} available`}
            </span>
          </span>
          <span className={`h-2.5 w-2.5 rounded-full ${creditExempt || (subscription?.creditBalance ?? 0) > 0 ? 'bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,.65)]' : 'bg-slate-600'}`} />
        </NavLink>
        <div className="mb-2 flex items-center gap-3 rounded-xl px-3 py-2">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-emerald-400/25 to-lime-400/20 text-xs font-bold text-emerald-100 ring-1 ring-emerald-200/10">
            {initials}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium text-slate-200">
              {user?.name || 'Traveler'}
            </span>
            {user?.email && (
              <span className="block truncate text-xs text-slate-500">{user.email}</span>
            )}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={handleLogout} className="flex flex-1 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-500 transition-colors hover:bg-red-400/10 hover:text-red-300">
            <Icon name="logout" />
            <span>Log out</span>
          </button>
          <ThemeToggle className="border-white/10 bg-white/[0.04] text-slate-400 shadow-none hover:bg-white/[0.08] hover:text-white" />
        </div>
      </div>
    </aside>
  );
}
