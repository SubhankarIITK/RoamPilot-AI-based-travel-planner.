import { useState } from 'react';
import VoiceInputButton from '../common/VoiceInputButton.jsx';
import PhotoLightbox from './PhotoLightbox.jsx';
import { englishDisplayText } from '../../utils/englishDisplayText.js';

const periodLabel = time => {
  const hour = Number.parseInt(String(time || '').split(':')[0], 10);
  if (Number.isNaN(hour) || hour < 12) return 'Morning';
  if (hour < 17) return 'Afternoon';
  if (hour < 21) return 'Evening';
  return 'Night';
};

const mapCoordinates = value => {
  const coordinates = value?.coordinates;
  const latitude = Number(Array.isArray(coordinates) ? coordinates[1] : coordinates?.latitude);
  const longitude = Number(Array.isArray(coordinates) ? coordinates[0] : coordinates?.longitude);
  return Number.isFinite(latitude) && Number.isFinite(longitude)
    ? [longitude, latitude]
    : null;
};

const openExternalMap = (value, destination = '') => {
  const coordinates = mapCoordinates(value);
  const url = coordinates
    ? `https://www.openstreetmap.org/?mlat=${coordinates[1]}&mlon=${coordinates[0]}#map=16/${coordinates[1]}/${coordinates[0]}`
    : `https://www.openstreetmap.org/search?query=${encodeURIComponent([
        value?.location || value?.placeOrArea || value?.activity,
        destination,
      ].filter(Boolean).join(', '))}`;
  window.open(url, '_blank', 'noopener,noreferrer');
};

function DayPhotoGrid({ places, loading }) {
  const [previewIndex, setPreviewIndex] = useState(null);

  if (loading) {
    return (
      <div className="mb-5 overflow-hidden rounded-2xl border border-emerald-200/70 bg-gradient-to-br from-emerald-50 to-lime-50 p-3 dark:border-emerald-300/15 dark:from-emerald-400/[0.08] dark:to-lime-400/[0.05]">
        <div className="h-4 w-32 animate-pulse rounded-full bg-emerald-200/60 dark:bg-emerald-200/15" />
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {[0, 1, 2].map(item => (
            <div key={item} className="h-28 animate-pulse rounded-2xl bg-emerald-200/40 dark:bg-emerald-200/10" />
          ))}
        </div>
      </div>
    );
  }

  const uniquePlaces = [];
  const seenImages = new Set();
  for (const place of places || []) {
    if (!place?.imageUrl) continue;
    const imageKey = String(place.imagePageUrl || place.imageUrl).split('?')[0];
    if (seenImages.has(imageKey)) continue;
    seenImages.add(imageKey);
    uniquePlaces.push(place);
  }

  if (!uniquePlaces.length) return null;

  const featured = uniquePlaces[0];
  const supporting = uniquePlaces.slice(1, 4);

  return (
    <section className="mb-5 overflow-hidden rounded-3xl border border-emerald-200/80 bg-emerald-950 shadow-sm shadow-emerald-950/10 dark:border-emerald-300/15">
      <div className="grid gap-px bg-emerald-900/70 md:grid-cols-[1.35fr_1fr]">
        <button
          type="button"
          onClick={() => setPreviewIndex(0)}
          aria-label={`Open photo of ${englishDisplayText(featured.placeName || featured.activity, 'itinerary place')}`}
          className="group relative min-h-[15rem] overflow-hidden bg-emerald-950 text-left focus:outline-none focus:ring-2 focus:ring-inset focus:ring-emerald-300"
        >
          <img
            src={featured.imageUrl}
            alt={englishDisplayText(featured.placeName || featured.activity, 'Itinerary place')}
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-[1.04]"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-emerald-950 via-emerald-950/45 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-5">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-emerald-200">Day visual guide</p>
            <h4 className="mt-1 text-xl font-extrabold text-white">{englishDisplayText(featured.placeName, 'Itinerary place')}</h4>
            {featured.activity && <p className="mt-1 line-clamp-2 text-sm leading-5 text-emerald-50/80">{englishDisplayText(featured.activity)}</p>}
            <span className="mt-3 inline-flex rounded-full border border-white/20 bg-black/25 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white/90 backdrop-blur">
              View photo
            </span>
          </div>
        </button>

        <div className="grid bg-emerald-950 sm:grid-cols-3 md:grid-cols-1">
          {supporting.length > 0 ? supporting.map((place, index) => (
            <button
              type="button"
              key={`${place.placeName}-${place.imageUrl}`}
              onClick={() => setPreviewIndex(index + 1)}
              aria-label={`Open photo of ${englishDisplayText(place.placeName || place.activity, 'itinerary place')}`}
              className="group relative min-h-[7.5rem] overflow-hidden bg-emerald-950 text-left focus:outline-none focus:ring-2 focus:ring-inset focus:ring-emerald-300"
            >
              <img
                src={place.imageUrl}
                alt={englishDisplayText(place.placeName || place.activity, 'Itinerary place')}
                loading="lazy"
                className="absolute inset-0 h-full w-full object-cover opacity-85 transition duration-700 group-hover:scale-[1.04] group-hover:opacity-100"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-emerald-950 via-emerald-950/35 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-3">
                <p className="line-clamp-2 text-xs font-bold text-white">{englishDisplayText(place.placeName, 'Itinerary place')}</p>
              </div>
            </button>
          )) : (
            <div className="flex min-h-[7.5rem] items-end bg-gradient-to-br from-emerald-900 to-lime-900 p-4">
              <p className="text-xs leading-5 text-emerald-50/75">More place images appear here when the itinerary includes additional distinct locations.</p>
            </div>
          )}
        </div>
      </div>

      {featured.imageAttribution && (
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 text-[11px] text-emerald-50/60">
          <span>{featured.imageAttribution}</span>
          {featured.imagePageUrl && (
            <a href={featured.imagePageUrl} target="_blank" rel="noreferrer" className="font-semibold text-emerald-100 transition hover:text-white">
              View source
            </a>
          )}
        </div>
      )}

      {previewIndex !== null && (
        <PhotoLightbox
          images={uniquePlaces.slice(0, 4)}
          initialIndex={previewIndex}
          onClose={() => setPreviewIndex(null)}
        />
      )}
    </section>
  );
}

export default function ItineraryDayCard({
  day,
  destination,
  onRegenerate,
  onOpenMap,
  dayGallery,
  imagesLoading = false,
}) {
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
            <span className="mt-0.5 block truncate text-sm text-slate-500">{englishDisplayText(day.theme, 'Daily itinerary')}</span>
          </span>
        </span>
        <span className="flex items-center gap-2">
          {day.estimatedCost && <span className="hidden rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 sm:inline">{day.estimatedCost}</span>}
          <span className={`text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}>⌄</span>
        </span>
      </button>

      {open && (
        <div className="border-t border-slate-100 bg-slate-50/60 p-4 sm:p-5">
          {day.summary && <p className="mb-5 rounded-xl border border-blue-100 bg-blue-50/70 p-4 text-sm leading-6 text-slate-700 dark:border-blue-400/20 dark:bg-blue-400/[0.08] dark:text-slate-200">{englishDisplayText(day.summary)}</p>}

          <DayPhotoGrid places={dayGallery?.places} loading={imagesLoading && !dayGallery} />

          {(day.startArea || day.endArea || day.walkingEstimate) && (
            <div className="mb-5 grid gap-2 sm:grid-cols-3">
              {day.startArea && <div className="rounded-xl border border-slate-200 bg-white p-3 text-xs"><span className="block font-bold uppercase tracking-wider text-slate-400">Start area</span><span className="mt-1 block font-semibold text-slate-700">{englishDisplayText(day.startArea, destination)}</span></div>}
              {day.endArea && <div className="rounded-xl border border-slate-200 bg-white p-3 text-xs"><span className="block font-bold uppercase tracking-wider text-slate-400">End area</span><span className="mt-1 block font-semibold text-slate-700">{englishDisplayText(day.endArea, destination)}</span></div>}
              {day.walkingEstimate && <div className="rounded-xl border border-slate-200 bg-white p-3 text-xs"><span className="block font-bold uppercase tracking-wider text-slate-400">Walking load</span><span className="mt-1 block font-semibold text-slate-700">{day.walkingEstimate}</span></div>}
            </div>
          )}

          {day.advanceBookings?.length > 0 && (
            <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-3">
              <p className="text-xs font-extrabold uppercase tracking-wider text-amber-800">Book before this day</p>
              <ul className="mt-2 space-y-1">
                {day.advanceBookings.map((booking, index) => <li key={`${booking}-${index}`} className="text-xs leading-5 text-amber-700">• {englishDisplayText(booking)}</li>)}
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
                  <button type="button" onClick={() => toggleCompleted(index)} aria-label={`Mark ${englishDisplayText(item.activity, 'activity')} complete`} className={`relative z-10 mt-1 grid h-4 w-4 place-items-center rounded-full border-2 transition ${completed[index] ? 'border-emerald-500 bg-emerald-500 text-[9px] text-white' : 'border-blue-400 bg-white'}`}>
                    {completed[index] ? '✓' : ''}
                  </button>
                  <div className={`rounded-xl border bg-white p-4 shadow-sm transition dark:bg-slate-900/80 ${completed[index] ? 'border-emerald-200 opacity-65 dark:border-emerald-400/25' : 'border-slate-200 dark:border-white/10'}`}>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600">{periodLabel(item.time)}</span>
                        <h4 className={`mt-0.5 font-bold text-slate-900 ${completed[index] ? 'line-through' : ''}`}>{englishDisplayText(item.activity, 'Scheduled visit')}</h4>
                        {item.location && (
                          <button
                            type="button"
                            onClick={() => {
                              const stopId = `schedule-${day.day}-${index}`;
                              if (onOpenMap && mapCoordinates(item)) onOpenMap(stopId);
                              else openExternalMap(item, destination);
                            }}
                            className="mt-0.5 inline-flex items-start gap-1 text-left text-xs font-semibold text-emerald-700 transition hover:text-emerald-600 hover:underline dark:text-emerald-300"
                            title="View this location on the map"
                          >
                            <span aria-hidden="true">📍</span>
                            <span>{englishDisplayText(item.location, destination || 'View location')}</span>
                          </button>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {item.bookingRequired && <span className="rounded-full bg-amber-50 px-2 py-1 text-[10px] font-bold text-amber-700">Book ahead</span>}
                        {item.estimatedCost && <span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700">{item.estimatedCost}</span>}
                      </div>
                    </div>
                    {item.details && <p className="mt-3 text-sm leading-6 text-slate-600">{englishDisplayText(item.details)}</p>}
                    {(item.travelTime || item.transport) && <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-500">Getting there: {[item.travelTime, item.transport].filter(Boolean).map(value => englishDisplayText(value)).join(' · ')}</p>}
                    {item.bookingAdvice && <p className="mt-2 text-xs leading-5 text-amber-700">Booking: {englishDisplayText(item.bookingAdvice)}</p>}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {['morning', 'afternoon', 'evening', 'night'].map(period => day[period]?.length > 0 && (
                <div key={period}>
                  <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">{period}</h4>
                  <ul className="space-y-1.5 border-l-2 border-blue-100 pl-3">{day[period].map((item, index) => <li key={index} className="text-sm leading-6 text-slate-700">• {englishDisplayText(item)}</li>)}</ul>
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
                    <button
                      type="button"
                      onClick={() => {
                        const stopId = `meal-${day.day}-${index}`;
                        if (onOpenMap && mapCoordinates(meal)) onOpenMap(stopId);
                        else openExternalMap(meal, destination);
                      }}
                      className="mt-1 block text-left text-xs font-semibold text-emerald-700 transition hover:underline dark:text-emerald-300"
                      title="View this meal location on the map"
                    >
                      📍 {englishDisplayText(meal.placeOrArea, destination || 'View meal location')}
                    </button>
                    <p className="mt-1 text-xs leading-5 text-slate-500">{englishDisplayText(meal.suggestion)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {day.rainyDayAlternative && <div className="rounded-xl border border-sky-100 bg-sky-50 p-3 text-xs leading-5 text-sky-800"><strong className="block">Rain alternative</strong>{englishDisplayText(day.rainyDayAlternative)}</div>}
            {day.localTip && <div className="rounded-xl border border-amber-100 bg-amber-50 p-3 text-xs leading-5 text-amber-800"><strong className="block">Local tip</strong>{englishDisplayText(day.localTip)}</div>}
            {day.paceNotes && <div className="rounded-xl border border-violet-100 bg-violet-50 p-3 text-xs leading-5 text-violet-800"><strong className="block">Pace and rest</strong>{englishDisplayText(day.paceNotes)}</div>}
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
