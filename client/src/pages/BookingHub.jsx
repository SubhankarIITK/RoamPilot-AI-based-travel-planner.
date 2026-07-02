import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getTripById } from '../api/tripApi.js';
import { researchTrip } from '../api/aiApi.js';
import Loader from '../components/common/Loader.jsx';
import SelectField from '../components/common/SelectField.jsx';

const FormattedMessage = lazy(() => import('../components/ai/FormattedMessage.jsx'));

const safeDate = value => value ? new Date(value).toISOString().slice(0, 10) : '';

export default function BookingHub() {
  const { id } = useParams();
  const [trip, setTrip] = useState(null);
  const [loading, setLoading] = useState(true);
  const [researching, setResearching] = useState(false);
  const [focus, setFocus] = useState('best flight, train, and hotel options');
  const [research, setResearch] = useState('');
  const [researchMeta, setResearchMeta] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    getTripById(id)
      .then(response => setTrip(response.data.data))
      .catch(err => setError(err.response?.data?.message || 'Could not load booking details.'))
      .finally(() => setLoading(false));
  }, [id]);

  const providers = useMemo(() => {
    if (!trip) return [];
    const origin = trip.origin || '';
    const destination = trip.destination || '';
    const startDate = safeDate(trip.startDate);
    const endDate = safeDate(trip.endDate);
    const flightQuery = `Flights from ${origin || 'my location'} to ${destination}${startDate ? ` on ${startDate}` : ''}${endDate ? ` returning ${endDate}` : ''}`;
    const hotelParams = new URLSearchParams({ ss: destination, group_adults: String(trip.travelers || 1), no_rooms: '1' });
    if (startDate) hotelParams.set('checkin', startDate);
    if (endDate) hotelParams.set('checkout', endDate);

    return [
      { name: 'Flights', description: `Compare flights to ${destination} across airlines and travel sites.`, action: 'Search Google Flights', href: `https://www.google.com/travel/flights?q=${encodeURIComponent(flightQuery)}`, accent: 'bg-sky-50 text-sky-700', icon: '✈' },
      { name: 'Hotels', description: `Find stays in ${destination} for your dates and group size.`, action: 'Search Booking.com', href: `https://www.booking.com/searchresults.html?${hotelParams.toString()}`, accent: 'bg-indigo-50 text-indigo-700', icon: '⌂' },
      { name: 'Route options', description: `Compare train, bus, ferry, driving, and flight routes from ${origin || 'your origin'}.`, action: 'Compare on Rome2Rio', href: `https://www.rome2rio.com/map/${encodeURIComponent(origin || 'Current-location')}/${encodeURIComponent(destination)}`, accent: 'bg-emerald-50 text-emerald-700', icon: '↝' },
      { name: 'Indian Railways', description: 'Check official train schedules and ticket availability through IRCTC.', action: 'Open IRCTC', href: 'https://www.irctc.co.in/nget/train-search', accent: 'bg-amber-50 text-amber-700', icon: '▣' },
      { name: 'Intercity buses', description: 'Compare bus operators, boarding points, timings, and seat availability.', action: 'Search redBus', href: 'https://www.redbus.in/', accent: 'bg-rose-50 text-rose-700', icon: '▤' },
    ];
  }, [trip]);

  const handleResearch = async () => {
    setResearching(true);
    setError('');
    try {
      const response = await researchTrip(id, focus);
      setResearch(response.data.data.content);
      setResearchMeta(response.data.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Live travel research failed.');
    } finally {
      setResearching(false);
    }
  };

  if (loading) return <Loader />;

  return (
    <div className="page-container">
      <div className="mb-6">
        <Link to={`/trips/${id}`} className="mb-2 block text-sm font-medium text-blue-600 hover:underline">← Back to Workspace</Link>
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Book & Compare</h1>
        <p className="mt-1 text-sm leading-6 text-slate-500">Search transport and stays for {trip?.title}. Complete bookings securely on each provider’s website.</p>
      </div>
      {error && <div className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-600">{error}</div>}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {providers.map(provider => (
          <article key={provider.name} className="card flex min-h-56 flex-col">
            <span className={`grid h-11 w-11 place-items-center rounded-xl text-xl font-bold ${provider.accent}`}>{provider.icon}</span>
            <h2 className="mt-4 text-base font-bold text-slate-900">{provider.name}</h2>
            <p className="mt-2 flex-1 text-sm leading-6 text-slate-500">{provider.description}</p>
            <a href={provider.href} target="_blank" rel="noreferrer" className="btn-secondary mt-5 w-full text-center">{provider.action} ↗</a>
          </article>
        ))}
      </div>

      <section className="card mt-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
          <div className="flex-1">
            <label className="label" htmlFor="research-focus">Ask AI to research current options</label>
            <SelectField
              id="research-focus"
              value={focus}
              onChange={value => {
                setFocus(value);
                setResearch('');
                setResearchMeta(null);
              }}
              options={[
                { value: 'best flight, train, and hotel options', label: 'Flights, trains, and hotels' },
                { value: 'best transport routes, transfer times, and current service notices', label: 'Transport routes and service notices' },
                { value: 'recommended hotel neighborhoods, realistic nightly prices, and safety', label: 'Hotel areas, prices, and safety' },
                { value: 'current entry fees, attraction closures, and advance booking requirements', label: 'Attractions and advance bookings' },
              ]}
              ariaLabel="Research focus"
            />
          </div>
          <button onClick={handleResearch} disabled={researching} className="btn-primary w-full lg:w-auto lg:min-w-48">{researching ? 'Searching the web...' : 'Research live options'}</button>
        </div>
        {research && (
          <div className="mt-5 border-t border-slate-200 pt-5">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700 dark:bg-emerald-300/10 dark:text-emerald-200">
                Structured booking brief
              </span>
              {researchMeta?.providers?.map(provider => (
                <span
                  key={provider}
                  className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 dark:border-white/10 dark:text-slate-300"
                >
                  {provider}
                </span>
              ))}
              {researchMeta?.briefCacheHit && (
                <span className="text-xs font-medium text-slate-500">Cached synthesis</span>
              )}
            </div>
            <Suspense fallback={<p className="text-sm text-slate-500">Formatting research...</p>}>
              <FormattedMessage content={research} />
            </Suspense>
          </div>
        )}
      </section>

      <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs leading-5 text-amber-800">
        RoamPilot links to external providers; it does not sell tickets, process payments, or guarantee prices and availability. Verify passenger details, cancellation rules, schedules, visas, and baggage limits before paying.
      </div>
    </div>
  );
}
