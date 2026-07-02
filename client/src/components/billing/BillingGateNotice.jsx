import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

export default function BillingGateNotice() {
  const [notice, setNotice] = useState(null);
  const location = useLocation();

  useEffect(() => {
    const showNotice = event => setNotice(event.detail || {});
    window.addEventListener('roampilot:billing-required', showNotice);
    return () => window.removeEventListener('roampilot:billing-required', showNotice);
  }, []);

  useEffect(() => {
    setNotice(null);
  }, [location.pathname]);

  if (!notice) return null;

  return (
    <div className="fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-[90] mx-auto max-w-xl rounded-2xl border border-indigo-200 bg-white p-4 shadow-2xl dark:border-indigo-400/20 dark:bg-slate-900 sm:inset-x-4 sm:bottom-4 sm:flex sm:items-center sm:gap-4">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-extrabold text-slate-900 dark:text-white">AI access needs credits</p>
        <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-300">
          {notice.message || 'Choose a paid plan to continue using RoamPilot AI.'}
        </p>
      </div>
      <div className="mt-3 grid shrink-0 grid-cols-2 gap-2 sm:mt-0 sm:flex">
        <button type="button" onClick={() => setNotice(null)} className="btn-secondary text-xs">Dismiss</button>
        <Link to="/billing" className="btn-primary text-xs">View plans</Link>
      </div>
    </div>
  );
}
