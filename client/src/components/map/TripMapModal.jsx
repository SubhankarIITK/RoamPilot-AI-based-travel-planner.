import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import TripMap from './TripMap.jsx';

export default function TripMapModal({ days, initialDay, selectedStopId, onClose }) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = event => {
      if (event.key === 'Escape') onClose();
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/75 p-0 backdrop-blur-sm sm:p-5">
      <section
        role="dialog"
        aria-modal="true"
        aria-label="Trip map"
        className="flex h-dvh w-full max-w-6xl flex-col overflow-hidden bg-slate-50 shadow-2xl dark:bg-[#03120f] sm:h-auto sm:max-h-[calc(100dvh-2.5rem)] sm:rounded-3xl sm:border sm:border-emerald-300/20"
      >
        <header className="flex items-center justify-between gap-3 border-b border-emerald-100 bg-white px-4 py-3 dark:border-emerald-300/10 dark:bg-[#071d17] sm:px-5">
          <div>
            <p className="eyebrow">Interactive itinerary</p>
            <h2 className="mt-0.5 font-extrabold text-slate-900 dark:text-white">Places and daily route</h2>
          </div>
          <button type="button" onClick={onClose} className="btn-secondary h-11 w-11 p-0" aria-label="Close trip map">
            ×
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto p-2 sm:p-4">
          <TripMap days={days} initialDay={initialDay} selectedStopId={selectedStopId} />
        </div>
      </section>
    </div>,
    document.body,
  );
}
