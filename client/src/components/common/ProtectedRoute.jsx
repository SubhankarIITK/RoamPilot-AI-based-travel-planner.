import { useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import useAuthStore from '../../store/authStore.js';
import Navbar from '../layout/Navbar.jsx';
import Sidebar from '../layout/Sidebar.jsx';
import Loader from './Loader.jsx';
import { getMe } from '../../api/authApi.js';
import useBillingStore from '../../store/billingStore.js';
import BillingGateNotice from '../billing/BillingGateNotice.jsx';

export default function ProtectedRoute() {
  const { isAuthenticated, user, setUser, logout } = useAuthStore();
  const [checkingSession, setCheckingSession] = useState(isAuthenticated && !user);
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false);
  const location = useLocation();
  const { summary: billingSummary, loadBilling, setCreditBalance } = useBillingStore();

  useEffect(() => {
    if (!isAuthenticated || user) {
      setCheckingSession(false);
      return;
    }

    getMe()
      .then(response => setUser(response.data.data))
      .catch(() => logout({ remote: false }))
      .finally(() => setCheckingSession(false));
  }, [isAuthenticated, user, setUser, logout]);

  useEffect(() => {
    if (isAuthenticated && user && !billingSummary) {
      loadBilling().catch(() => {});
    }
  }, [isAuthenticated, user, billingSummary, loadBilling]);

  useEffect(() => {
    const updateBalance = event => setCreditBalance(event.detail.creditBalance);
    window.addEventListener('roampilot:credit-balance', updateBalance);
    return () => window.removeEventListener('roampilot:credit-balance', updateBalance);
  }, [setCreditBalance]);

  useEffect(() => {
    setMobileNavigationOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!mobileNavigationOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = event => {
      if (event.key === 'Escape') setMobileNavigationOpen(false);
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [mobileNavigationOpen]);

  if (checkingSession) return <Loader />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;

  return (
    <div className="flex min-h-screen bg-transparent">
      <Sidebar className="sticky top-0 hidden lg:flex" />
      <div className="min-w-0 flex-1">
        <div className="lg:hidden">
          <Navbar onMenuClick={() => setMobileNavigationOpen(true)} />
        </div>
        {mobileNavigationOpen && (
          <div className="fixed inset-0 z-[80] lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation menu">
            <button
              type="button"
              className="absolute inset-0 animate-[backdrop-in_180ms_ease-out] bg-slate-950/65 backdrop-blur-sm"
              onClick={() => setMobileNavigationOpen(false)}
              aria-label="Close navigation menu"
            />
            <Sidebar
              className="relative z-10 animate-[mobile-drawer-enter_220ms_ease-out]"
              onNavigate={() => setMobileNavigationOpen(false)}
            />
          </div>
        )}
        <main className="relative min-h-[calc(100dvh-64px)] overflow-x-clip lg:min-h-screen">
          <div className="pointer-events-none fixed inset-0 left-72 hidden opacity-70 lg:block">
            <div className="absolute -right-40 -top-56 h-[32rem] w-[32rem] rounded-full bg-lime-500/[0.055] blur-3xl dark:bg-lime-500/[0.08]" />
            <div className="absolute -bottom-52 left-20 h-[28rem] w-[28rem] rounded-full bg-emerald-500/[0.06] blur-3xl dark:bg-emerald-500/[0.09]" />
          </div>
          <Outlet />
          <BillingGateNotice />
        </main>
      </div>
    </div>
  );
}
