const toneConfig = {
  sunny: {
    emoji: '☀️',
    glow: 'from-amber-300/35 via-lime-300/20 to-emerald-400/10',
    label: 'Clear window',
  },
  cloudy: {
    emoji: '☁️',
    glow: 'from-slate-300/25 via-emerald-300/10 to-blue-400/10',
    label: 'Soft light',
  },
  rain: {
    emoji: '🌧️',
    glow: 'from-sky-300/25 via-emerald-300/10 to-blue-500/20',
    label: 'Rain aware',
  },
  storm: {
    emoji: '⛈️',
    glow: 'from-violet-300/25 via-sky-300/15 to-emerald-400/10',
    label: 'Watch timing',
  },
  snow: {
    emoji: '❄️',
    glow: 'from-cyan-200/30 via-white/10 to-emerald-300/10',
    label: 'Layer up',
  },
  fog: {
    emoji: '🌫️',
    glow: 'from-slate-200/25 via-white/10 to-emerald-300/10',
    label: 'Low visibility',
  },
};

const temp = value => (Number.isFinite(Number(value)) ? `${Math.round(Number(value))}°` : '—');

const formatUpdated = value => {
  if (!value) return 'Just now';
  try {
    return new Intl.DateTimeFormat('en', {
      hour: 'numeric',
      minute: '2-digit',
      day: 'numeric',
      month: 'short',
    }).format(new Date(value));
  } catch {
    return 'Just now';
  }
};

function WeatherSkeleton() {
  return (
    <section className="overflow-hidden rounded-3xl border border-emerald-300/15 bg-emerald-950 p-6 shadow-2xl shadow-emerald-950/25">
      <div className="h-4 w-56 animate-pulse rounded-full bg-emerald-100/15" />
      <div className="mt-6 h-16 w-32 animate-pulse rounded-2xl bg-emerald-100/15" />
      <div className="mt-8 flex gap-px overflow-x-auto rounded-2xl bg-white/10 sm:grid sm:grid-cols-5 sm:overflow-hidden">
        {[0, 1, 2, 3, 4].map(item => (
          <div key={item} className="h-28 min-w-32 animate-pulse bg-white/[0.045] sm:min-w-0" />
        ))}
      </div>
    </section>
  );
}

export default function WeatherPanel({ weather, loading, onRefresh }) {
  if (loading || !weather) return <WeatherSkeleton />;

  if (!weather?.available) {
    return (
      <div className="card py-12 text-center">
        <div className="text-4xl">🌦️</div>
        <h3 className="mt-3 text-lg font-extrabold text-slate-900 dark:text-white">Weather is unavailable right now</h3>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500 dark:text-slate-300">
          The trip is safe to view without it. Open this tab again later and RoamPilot will refresh from the weather provider.
        </p>
      </div>
    );
  }

  const data = weather.weather;
  const current = data?.current || {};
  const tone = toneConfig[current.tone] || toneConfig.cloudy;
  const daily = Array.isArray(data?.daily) ? data.daily.slice(0, 5) : [];
  const rainNow = Number(current.precipitationMm || current.rainMm || 0);

  return (
    <section className="overflow-hidden rounded-3xl border border-emerald-300/20 bg-[#071611] shadow-2xl shadow-emerald-950/25">
      <div className="relative min-h-[17rem] overflow-hidden p-6 sm:p-8">
        <div className={`absolute inset-0 bg-gradient-to-br ${tone.glow}`} />
        <div className="absolute -left-20 -top-24 h-72 w-72 rounded-full bg-emerald-300/10 blur-3xl" />
        <div className="absolute -bottom-24 right-10 h-72 w-72 rounded-full bg-lime-300/10 blur-3xl" />
        {current.tone === 'rain' && (
          <div className="pointer-events-none absolute inset-0 opacity-25">
            {[...Array(18)].map((_, index) => (
              <span
                key={index}
                className="absolute top-0 h-24 w-px -rotate-12 rounded-full bg-sky-100/70"
                style={{ left: `${index * 6 + 2}%`, animationDelay: `${index * 90}ms` }}
              />
            ))}
          </div>
        )}

        <div className="relative z-10 flex min-h-[12rem] flex-col justify-between gap-8 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.25em] text-emerald-100/60">
              {data?.resolvedLocation || weather.destination}
            </p>
            <div className="mt-3 flex items-end gap-4">
              <span className="text-6xl font-black leading-none tracking-tight text-white sm:text-7xl">
                {temp(current.temperatureC)}
              </span>
              <div className="pb-1">
                <p className="text-sm font-bold text-emerald-50">{current.condition}</p>
                <p className="mt-1 text-xs text-emerald-100/60">Feels like {temp(current.feelsLikeC)}C</p>
              </div>
            </div>
          </div>

          <div className="grid gap-2 text-left sm:min-w-56 sm:text-right">
            <div className="self-end rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-left backdrop-blur-xl">
              <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-emerald-100/60">{tone.label}</p>
              <p className="mt-1 text-sm font-bold text-white">{tone.emoji} Current travel weather</p>
            </div>
            {onRefresh && (
              <button
                type="button"
                onClick={onRefresh}
                className="justify-self-end rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-xs font-bold text-emerald-50 transition hover:bg-white/15"
              >
                Refresh cached weather
              </button>
            )}
            <p className="text-xs text-emerald-100/55">
              Updated {formatUpdated(data?.fetchedAt)} · Data from {data?.providerLabel || 'Open-Meteo'}
            </p>
          </div>
        </div>
      </div>

      <div className="flex snap-x gap-px overflow-x-auto bg-white/10 sm:grid sm:grid-cols-5 sm:overflow-visible">
        {daily.map(day => (
          <div key={day.date} className="min-w-[8.5rem] snap-start bg-[#0b1d19]/95 px-4 py-4 text-center sm:min-w-0">
            <p className="text-xs font-bold text-emerald-100/55">{day.label}</p>
            <p className="mt-2 text-lg font-extrabold text-white">{temp(day.maxC)}</p>
            <p className="text-xs text-emerald-100/55">low {temp(day.minC)}</p>
            <p className="mt-2 text-xs font-semibold text-sky-100/70">💧 {day.precipitationProbability ?? 0}%</p>
          </div>
        ))}
      </div>

      <div className="grid gap-3 border-t border-white/10 bg-[#06130f] p-4 text-sm text-emerald-50/75 sm:grid-cols-3">
        <div className="rounded-2xl bg-white/[0.045] p-4">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-emerald-100/45">Humidity</p>
          <p className="mt-1 text-xl font-black text-white">{current.humidity ?? '—'}%</p>
        </div>
        <div className="rounded-2xl bg-white/[0.045] p-4">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-emerald-100/45">Wind</p>
          <p className="mt-1 text-xl font-black text-white">{Math.round(Number(current.windKph || 0))} km/h</p>
        </div>
        <div className="rounded-2xl bg-white/[0.045] p-4">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-emerald-100/45">Rain now</p>
          <p className="mt-1 text-xl font-black text-white">{rainNow.toFixed(1)} mm</p>
        </div>
      </div>
    </section>
  );
}
