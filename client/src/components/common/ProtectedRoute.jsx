import { useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
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
  const { summary: billingSummary, loadBilling, setCreditBalance } = useBillingStore();

  useEffect(() => {
    if (!isAuthenticated || user) {
      setCheckingSession(false);
      return;
    }

    getMe()
      .then(response => setUser(response.data.data))
      .catch(() => logout())
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

  if (checkingSession) return <Loader />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;

  return (
    <div className="flex min-h-screen bg-transparent">
      <Sidebar className="sticky top-0 hidden lg:flex" />
      <div className="min-w-0 flex-1">
        <div className="lg:hidden">
          <Navbar />
        </div>
        <main className="relative min-h-[calc(100vh-64px)] overflow-hidden lg:min-h-screen">
          <div className="pointer-events-none fixed inset-0 left-72 hidden opacity-70 lg:block">
            <div className="absolute -right-40 -top-56 h-[32rem] w-[32rem] rounded-full bg-violet-500/[0.055] blur-3xl dark:bg-violet-500/[0.09]" />
            <div className="absolute -bottom-52 left-20 h-[28rem] w-[28rem] rounded-full bg-blue-500/[0.05] blur-3xl dark:bg-blue-500/[0.07]" />
          </div>
          <Outlet />
          <BillingGateNotice />
        </main>
      </div>
    </div>
  );
}
