import { Link } from 'react-router-dom';
import { formatDate } from '../../utils/formatDate.js';
import { formatCurrency } from '../../utils/formatCurrency.js';

export default function TripCard({ trip, onDelete }) {
  const statusColors = {
    planning: 'bg-amber-50 text-amber-700 dark:text-amber-300',
    confirmed: 'bg-blue-50 text-blue-700 dark:text-blue-300',
    ongoing: 'bg-emerald-50 text-emerald-700 dark:text-emerald-300',
    completed: 'bg-slate-100 text-slate-600 dark:text-slate-300',
    cancelled: 'bg-red-50 text-red-600 dark:text-red-300',
  };

  return (
    <article className="card group relative flex h-full flex-col overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:border-indigo-300/70 hover:shadow-[0_22px_55px_rgba(30,41,59,0.11)] dark:hover:border-indigo-400/30">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-indigo-400/60 to-transparent opacity-0 transition group-hover:opacity-100" />
      <div className="mb-5 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.16em] text-indigo-500">Trip workspace</p>
          <Link to={`/trips/${trip._id}`} className="block truncate text-lg font-extrabold tracking-tight text-slate-900 transition group-hover:text-indigo-600 dark:group-hover:text-indigo-300">{trip.title}</Link>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-500"><span className="text-indigo-400">⌖</span>{trip.destination}</p>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${statusColors[trip.status]}`}>{trip.status}</span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 dark:border-white/[0.06]"><span className="block text-[10px] font-bold uppercase tracking-wide text-slate-400">Dates</span><span className="mt-1 block text-xs font-semibold text-slate-700">{formatDate(trip.startDate)} — {formatDate(trip.endDate)}</span></div>
        <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 dark:border-white/[0.06]"><span className="block text-[10px] font-bold uppercase tracking-wide text-slate-400">Budget</span><span className="mt-1 block text-xs font-semibold text-slate-700">{formatCurrency(trip.budget, trip.currency)}</span></div>
        <div className="col-span-2 flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 p-3 text-xs dark:border-white/[0.06]"><span className="text-slate-500">{trip.travelers} traveler{trip.travelers === 1 ? '' : 's'}</span><span className="font-semibold text-slate-700">{trip.planningMode}</span></div>
      </div>

      <div className="mt-auto flex items-center gap-2 pt-5">
        <Link to={`/trips/${trip._id}`} className="btn-primary flex-1 text-xs">Open workspace</Link>
        <Link to={`/trips/${trip._id}/planner`} className="btn-secondary px-3 text-xs" aria-label="Open AI planner">✦</Link>
        {onDelete && <button onClick={() => onDelete(trip._id)} className="rounded-xl p-2.5 text-xs font-semibold text-slate-400 transition hover:bg-red-50 hover:text-red-600 dark:hover:text-red-300" aria-label={`Delete ${trip.title}`}>Delete</button>}
      </div>
    </article>
  );
}
