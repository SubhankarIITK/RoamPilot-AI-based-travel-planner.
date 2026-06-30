import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { formatDate } from '../../utils/formatDate.js';
import { formatCurrency } from '../../utils/formatCurrency.js';

export default function TripCard({ trip, onDelete }) {
  const navigate = useNavigate();
  const images = useMemo(
    () => (trip.cardImages || []).filter(image => image?.imageUrl),
    [trip.cardImages],
  );
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const hasImages = images.length > 0;

  useEffect(() => {
    setActiveImageIndex(0);
    if (images.length <= 1 ||
        window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      return undefined;
    }
    const interval = window.setInterval(() => {
      setActiveImageIndex(index => (index + 1) % images.length);
    }, 5500);
    return () => window.clearInterval(interval);
  }, [images]);

  const statusColors = {
    planning: 'bg-amber-50 text-amber-700 dark:text-amber-300',
    confirmed: 'bg-blue-50 text-blue-700 dark:text-blue-300',
    ongoing: 'bg-emerald-50 text-emerald-700 dark:text-emerald-300',
    completed: 'bg-slate-100 text-slate-600 dark:text-slate-300',
    cancelled: 'bg-red-50 text-red-600 dark:text-red-300',
  };
  const infoClass = hasImages
    ? 'border-white/15 bg-black/25 backdrop-blur-sm'
    : 'border-slate-100 bg-slate-50 dark:border-white/[0.06]';
  const mainText = hasImages ? 'text-white' : 'text-slate-900';
  const secondaryText = hasImages ? 'text-white/75' : 'text-slate-500';
  const detailText = hasImages ? 'text-white/90' : 'text-slate-700';
  const openWorkspace = () => navigate(`/trips/${trip._id}`);
  const handleCardClick = event => {
    if (event.target.closest('a, button')) return;
    openWorkspace();
  };
  const handleCardKeyDown = event => {
    if (event.target !== event.currentTarget || !['Enter', ' '].includes(event.key)) return;
    event.preventDefault();
    openWorkspace();
  };

  return (
    <article
      role="link"
      tabIndex={0}
      aria-label={`Open ${trip.title} workspace`}
      onClick={handleCardClick}
      onKeyDown={handleCardKeyDown}
      className="card group relative flex min-h-[302px] cursor-pointer flex-col overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:border-emerald-300/70 hover:shadow-[0_22px_55px_rgba(3,36,25,0.28)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2"
    >
      {images.map((image, index) => (
        <div
          key={`${image.imageUrl}-${index}`}
          aria-hidden="true"
          className={`absolute inset-0 bg-cover bg-center transition-opacity duration-1000 ${
            index === activeImageIndex ? 'opacity-100' : 'opacity-0'
          }`}
          style={{ backgroundImage: `url("${image.imageUrl}")` }}
        />
      ))}
      {hasImages && (
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-br from-emerald-950/95 via-emerald-950/78 to-black/55"
        />
      )}
      <div className="absolute inset-x-0 top-0 z-10 h-px bg-gradient-to-r from-transparent via-emerald-300/70 to-transparent opacity-0 transition group-hover:opacity-100" />

      <div className="relative z-10 flex h-full flex-1 flex-col">
        <div className="mb-5 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className={`mb-1 text-[10px] font-bold uppercase tracking-[0.16em] ${
              hasImages ? 'text-emerald-200' : 'text-indigo-500'
            }`}>Trip workspace</p>
            <Link
              to={`/trips/${trip._id}`}
              className={`block truncate text-lg font-extrabold tracking-tight transition group-hover:text-emerald-300 ${mainText}`}
            >
              {trip.title}
            </Link>
            <p className={`mt-1 flex items-center gap-1.5 text-sm ${secondaryText}`}>
              <span className={hasImages ? 'text-emerald-300' : 'text-indigo-400'}>⌖</span>
              {trip.destination}
            </p>
          </div>
          <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide backdrop-blur-sm ${statusColors[trip.status]}`}>
            {trip.status}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className={`rounded-xl border p-3 ${infoClass}`}>
            <span className={`block text-[10px] font-bold uppercase tracking-wide ${hasImages ? 'text-emerald-100/65' : 'text-slate-400'}`}>Dates</span>
            <span className={`mt-1 block text-xs font-semibold ${detailText}`}>
              {formatDate(trip.startDate)} — {formatDate(trip.endDate)}
            </span>
          </div>
          <div className={`rounded-xl border p-3 ${infoClass}`}>
            <span className={`block text-[10px] font-bold uppercase tracking-wide ${hasImages ? 'text-emerald-100/65' : 'text-slate-400'}`}>Budget</span>
            <span className={`mt-1 block text-xs font-semibold ${detailText}`}>
              {Number(trip.budget) > 0
                ? formatCurrency(trip.budget, trip.currency)
                : String(trip.budgetMode || 'AI-managed').replaceAll('-', ' ')}
            </span>
          </div>
          <div className={`col-span-2 flex items-center justify-between rounded-xl border p-3 text-xs ${infoClass}`}>
            <span className={secondaryText}>
              {trip.travelers} traveler{trip.travelers === 1 ? '' : 's'}
            </span>
            <span className={`font-semibold ${detailText}`}>{trip.planningMode}</span>
          </div>
        </div>

        <div className="mt-auto flex items-center gap-2 pt-5">
          <Link to={`/trips/${trip._id}`} className="btn-primary flex-1 text-xs">
            Open workspace
          </Link>
          <Link
            to={`/trips/${trip._id}/planner`}
            className={`btn-secondary px-3 text-xs ${hasImages ? 'border-white/20 bg-black/25 text-white hover:bg-black/40' : ''}`}
            aria-label="Open AI planner"
          >
            ✦
          </Link>
          {onDelete && (
            <button
              onClick={() => onDelete(trip._id)}
              className={`rounded-xl p-2.5 text-xs font-semibold transition hover:bg-red-50 hover:text-red-600 ${
                hasImages ? 'text-white/65 hover:bg-red-950/50 hover:text-red-200' : 'text-slate-400'
              }`}
              aria-label={`Delete ${trip.title}`}
            >
              Delete
            </button>
          )}
        </div>

        {images.length > 1 && (
          <div className="mt-3 flex justify-center gap-1.5" aria-label="Trip card image position">
            {images.map((image, index) => (
              <span
                key={`indicator-${image.imageUrl}-${index}`}
                className={`h-1 rounded-full transition-all duration-500 ${
                  index === activeImageIndex ? 'w-5 bg-emerald-300' : 'w-1.5 bg-white/35'
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </article>
  );
}
