import { useState } from 'react';
import VoiceInputButton from '../common/VoiceInputButton.jsx';

const periodLabel = time => {
  const hour = Number.parseInt(String(time || '').split(':')[0], 10);
  if (Number.isNaN(hour) || hour < 12) return 'Morning';
  if (hour < 17) return 'Afternoon';
  if (hour < 21) return 'Evening';
  return 'Night';
};

export default function ItineraryDayCard({ day, onRegenerate }) {
  const [open, setOpen] = useState(day.day === 1);
  const [instruction, setInstruction] = useState('');
  const [completed, setCompleted] = useState({});
  const hasDetailedSchedule = Array.isArray(day.schedule) && day.schedule.length > 0;

  const toggleCompleted = index => {
    setCompleted(current => ({ ...current, [index]: !current[index] }));
  };

  return (
    <article className="card mb-4 overflow-hidden p-0 transition hover:border-blue-200">
      <button type="button" className="flex w-full items-center justify-between gap-4 p-5 text-left" onClick={() => setOpen(!open)}>
        <span className="flex min-w-0 items-center gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-blue-50 text-sm font-extrabold text-blue-700">{day.day}</span>
          <span className="min-w-0">
            <span className="font-bold text-slate-900">Day {day.day}</span>
            {day.date && <span className="ml-2 text-xs text-slate-400">{day.date}</span>}
            <span className="mt-0.5 block truncate text-sm text-slate-500">{day.theme}</span>
          </span>
        </span>
        <span className="flex items-center gap-2">
          {day.estimatedCost && <span className="hidden rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 sm:inline">{day.estimatedCost}</span>}
          <span className={`text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}>⌄</span>
        </span>
      </button>

      {open && (
        <div className="border-t border-slate-100 bg-slate-50/60 p-4 sm:p-5">
          {day.summary && <p className="mb-5 rounded-xl border border-blue-100 bg-blue-50/70 p-4 text-sm leading-6 text-slate-700 dark:border-blue-400/20 dark:bg-blue-400/[0.08] dark:text-slate-200">{day.summary}</p>}

          {(day.startArea || day.endArea || day.walkingEstimate) && (
            <div className="mb-5 grid gap-2 sm:grid-cols-3">
              {day.startArea && <div className="rounded-xl border border-slate-200 bg-white p-3 text-xs"><span className="block font-bold uppercase tracking-wider text-slate-400">Start area</span><span className="mt-1 block font-semibold text-slate-700">{day.startArea}</span></div>}
              {day.endArea && <div className="rounded-xl border border-slate-200 bg-white p-3 text-xs"><span className="block font-bold uppercase tracking-wider text-slate-400">End area</span><span className="mt-1 block font-semibold text-slate-700">{day.endArea}</span></div>}
              {day.walkingEstimate && <div className="rounded-xl border border-slate-200 bg-white p-3 text-xs"><span className="block font-bold uppercase tracking-wider text-slate-400">Walking load</span><span className="mt-1 block font-semibold text-slate-700">{day.walkingEstimate}</span></div>}
            </div>
          )}

          {day.advanceBookings?.length > 0 && (
            <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-3">
              <p className="text-xs font-extrabold uppercase tracking-wider text-amber-800">Book before this day</p>
              <ul className="mt-2 space-y-1">
                {day.advanceBookings.map((booking, index) => <li key={`${booking}-${index}`} className="text-xs leading-5 text-amber-700">• {booking}</li>)}
              </ul>
            </div>
          )}

          {hasDetailedSchedule ? (
            <div className="relative space-y-0">
              <div className="absolute bottom-5 left-[4.35rem] top-5 w-px bg-blue-200 sm:left-[5.35rem]" />
              {day.schedule.map((item, index) => (
                <div key={`${item.time}-${item.activity}-${index}`} className="relative grid grid-cols-[3.3rem_1rem_1fr] gap-2 pb-5 sm:grid-cols-[4.3rem_1rem_1fr] sm:gap-3">
                  <div className="pt-1 text-right">
                    <div className="text-sm font-bold text-slate-800">{item.time || '—'}</div>
                    <div className="mt-0.5 text-[10px] text-slate-400">{item.duration}</div>
                  </div>
                  <button type="button" onClick={() => toggleCompleted(index)} aria-label={`Mark ${item.activity} complete`} className={`relative z-10 mt-1 grid h-4 w-4 place-items-center rounded-full border-2 transition ${completed[index] ? 'border-emerald-500 bg-emerald-500 text-[9px] text-white' : 'border-blue-400 bg-white'}`}>
                    {completed[index] ? '✓' : ''}
                  </button>
                  <div className={`rounded-xl border bg-white p-4 shadow-sm transition dark:bg-slate-900/80 ${completed[index] ? 'border-emerald-200 opacity-65 dark:border-emerald-400/25' : 'border-slate-200 dark:border-white/10'}`}>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600">{periodLabel(item.time)}</span>
                        <h4 className={`mt-0.5 font-bold text-slate-900 ${completed[index] ? 'line-through' : ''}`}>{item.activity}</h4>
                        {item.location && <p className="mt-0.5 text-xs font-medium text-slate-500">📍 {item.location}</p>}
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {item.bookingRequired && <span className="rounded-full bg-amber-50 px-2 py-1 text-[10px] font-bold text-amber-700">Book ahead</span>}
                        {item.estimatedCost && <span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700">{item.estimatedCost}</span>}
                      </div>
                    </div>
                    {item.details && <p className="mt-3 text-sm leading-6 text-slate-600">{item.details}</p>}
                    {(item.travelTime || item.transport) && <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-500">Getting there: {[item.travelTime, item.transport].filter(Boolean).join(' · ')}</p>}
                    {item.bookingAdvice && <p className="mt-2 text-xs leading-5 text-amber-700">Booking: {item.bookingAdvice}</p>}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {['morning', 'afternoon', 'evening', 'night'].map(period => day[period]?.length > 0 && (
                <div key={period}>
                  <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">{period}</h4>
                  <ul className="space-y-1.5 border-l-2 border-blue-100 pl-3">{day[period].map((item, index) => <li key={index} className="text-sm leading-6 text-slate-700">• {item}</li>)}</ul>
                </div>
              ))}
            </div>
          )}

          {day.meals?.length > 0 && (
            <div className="mt-2">
              <h4 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">Meal plan</h4>
              <div className="grid gap-3 md:grid-cols-3">
                {day.meals.map((meal, index) => (
                  <div key={`${meal.meal}-${index}`} className="rounded-xl border border-slate-200 bg-white p-3">
                    <div className="flex items-center justify-between gap-2"><span className="text-xs font-bold text-slate-800">{meal.meal} · {meal.time}</span><span className="text-[10px] font-semibold text-emerald-700">{meal.estimatedCost}</span></div>
                    <p className="mt-1 text-xs font-medium text-blue-700">{meal.placeOrArea}</p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">{meal.suggestion}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {day.rainyDayAlternative && <div className="rounded-xl border border-sky-100 bg-sky-50 p-3 text-xs leading-5 text-sky-800"><strong className="block">Rain alternative</strong>{day.rainyDayAlternative}</div>}
            {day.localTip && <div className="rounded-xl border border-amber-100 bg-amber-50 p-3 text-xs leading-5 text-amber-800"><strong className="block">Local tip</strong>{day.localTip}</div>}
            {day.paceNotes && <div className="rounded-xl border border-violet-100 bg-violet-50 p-3 text-xs leading-5 text-violet-800"><strong className="block">Pace and rest</strong>{day.paceNotes}</div>}
          </div>

          {day.dailyBudget && (
            <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-600">
              <strong className="text-slate-800">Daily estimate</strong>
              <span>Activities: {day.dailyBudget.activities}</span>
              <span>Food: {day.dailyBudget.food}</span>
              <span>Local transport: {day.dailyBudget.localTransport}</span>
              <span className="font-bold text-emerald-700">Total: {day.dailyBudget.total}</span>
            </div>
          )}

          {onRegenerate && (
            <div className="mt-5 flex flex-col gap-2 border-t border-slate-200 pt-4 sm:flex-row">
              <input data-voice-disabled="true" className="input flex-1 text-xs" placeholder="Change this day, e.g. fewer museums and more local food" value={instruction} onChange={event => setInstruction(event.target.value)} />
              <VoiceInputButton compact value={instruction} onChange={setInstruction} label={`Speak changes for day ${day.day}`} />
              <button type="button" onClick={() => onRegenerate(day.day, instruction)} className="btn-secondary text-xs">Regenerate Day</button>
            </div>
          )}
        </div>
      )}
    </article>
  );
}
