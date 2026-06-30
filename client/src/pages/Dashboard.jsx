import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { deleteTrip, getTripCardImages, getTrips } from '../api/tripApi.js';
import TripCard from '../components/trip/TripCard.jsx';
import Loader from '../components/common/Loader.jsx';
import EmptyState from '../components/common/EmptyState.jsx';
import useAuthStore from '../store/authStore.js';

export default function Dashboard() {
  const { user } = useAuthStore();
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getTrips()
      .then(async response => {
        const loadedTrips = response.data.data;
        if (cancelled) return;
        setTrips(loadedTrips);

        const plannedTripIds = loadedTrips
          .filter(trip => trip.aiPlan || trip.aiPlanV2)
          .slice(0, 12)
          .map(trip => trip._id);
        if (!plannedTripIds.length) return;

        try {
          const imagesResponse = await getTripCardImages(plannedTripIds);
          if (cancelled) return;
          const imagesByTrip = new Map(
            imagesResponse.data.data.trips.map(item => [String(item.tripId), item.images]),
          );
          setTrips(current => current.map(trip => imagesByTrip.has(String(trip._id))
            ? { ...trip, cardImages: imagesByTrip.get(String(trip._id)) }
            : trip));
        } catch {
          // Card backgrounds are optional and must never block the dashboard.
        }
      })
      .catch(error => console.error(error))
      .finally(() => setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  const activeTrips = trips.filter(trip => ['planning', 'confirmed', 'ongoing'].includes(trip.status)).length;
  const plannedTrips = trips.filter(trip => trip.aiPlan).length;

  const handleDelete = async id => {
    if (!confirm('Delete this trip?')) return;
    await deleteTrip(id);
    setTrips(current => current.filter(trip => trip._id !== id));
  };

  return (
    <div className="page-container">
      <section className="relative mb-7 overflow-hidden rounded-3xl border border-indigo-200/50 bg-gradient-to-br from-white via-indigo-50/70 to-blue-50 p-6 shadow-[0_20px_60px_rgba(79,70,229,0.08)] dark:border-white/10 dark:from-slate-900 dark:via-indigo-950/45 dark:to-slate-900 sm:p-8">
        <div className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full bg-violet-400/15 blur-3xl" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="eyebrow">Travel command center</p>
            <h1 className="mt-2 text-3xl font-extrabold tracking-[-0.035em] text-slate-950 dark:text-white sm:text-4xl">Welcome back, {user?.name?.split(' ')[0] || 'Traveler'}.</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-400">Plan intelligently, keep every booking organized, and move from idea to itinerary without the usual travel chaos.</p>
          </div>
          <Link to="/trips/new" className="btn-primary min-h-12 px-5">Create a new trip <span aria-hidden="true">→</span></Link>
        </div>
      </section>

      {!loading && trips.length > 0 && (
        <div className="mb-8 grid gap-3 sm:grid-cols-3">
          {[
            { label: 'Total trips', value: trips.length, icon: '◇', tone: 'blue' },
            { label: 'Active journeys', value: activeTrips, icon: '↗', tone: 'emerald' },
            { label: 'AI plans ready', value: plannedTrips, icon: '✦', tone: 'indigo' },
          ].map(metric => (
            <div key={metric.label} className="card flex items-center gap-4 p-4">
              <span className={`grid h-11 w-11 place-items-center rounded-xl text-lg font-bold ${metric.tone === 'emerald' ? 'bg-emerald-50 text-emerald-600 dark:text-emerald-300' : metric.tone === 'indigo' ? 'bg-indigo-50 text-indigo-600 dark:text-indigo-300' : 'bg-blue-50 text-blue-600 dark:text-blue-300'}`}>{metric.icon}</span>
              <div><div className="text-2xl font-extrabold tracking-tight text-slate-900">{metric.value}</div><div className="text-xs font-medium text-slate-500">{metric.label}</div></div>
            </div>
          ))}
        </div>
      )}

      <div className="mb-4 flex items-center justify-between">
        <div><p className="eyebrow">Your workspace</p><h2 className="mt-1 text-lg font-bold text-slate-900">Recent trips</h2></div>
        {trips.length > 0 && <span className="text-xs font-medium text-slate-500">{trips.length} total</span>}
      </div>

      {loading ? <Loader /> : trips.length === 0 ? (
        <EmptyState icon="✈" title="No trips yet" message="Create your first trip and let AI plan it with you." action={<Link to="/trips/new" className="btn-primary">Plan a Trip</Link>} />
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">{trips.map(trip => <TripCard key={trip._id} trip={trip} onDelete={handleDelete} />)}</div>
      )}
    </div>
  );
}
