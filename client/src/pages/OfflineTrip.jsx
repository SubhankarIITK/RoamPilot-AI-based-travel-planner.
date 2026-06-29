import { useState, useEffect } from 'react';
import { getOfflineTrips, clearOfflineTrip } from '../utils/localTripStorage.js';
import PageHeader from '../components/common/PageHeader.jsx';
import ItineraryDayCard from '../components/itinerary/ItineraryDayCard.jsx';
import EmptyState from '../components/common/EmptyState.jsx';
import { formatDateTime } from '../utils/formatDate.js';
import useAuthStore from '../store/authStore.js';

export default function OfflineTrip() {
  const [trips, setTrips] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const user = useAuthStore(state => state.user);

  useEffect(() => {
    const stored = getOfflineTrips(user?._id);
    setTrips(stored);
    setSelectedId(stored[0]?.tripId || null);
  }, [user?._id]);

  const data = trips.find(trip => trip.tripId === selectedId) || trips[0];

  if (!data) {
    return (
      <div className="page-container">
        <PageHeader title="Offline Trip" subtitle="Access your saved trip without internet" />
        <EmptyState icon="📴" title="No offline trip saved" message="Open any trip workspace and click 'Save Offline' to store it here." />
      </div>
    );
  }

  const handleClear = () => {
    clearOfflineTrip(data.tripId, user?._id);
    const remaining = trips.filter(trip => trip.tripId !== data.tripId);
    setTrips(remaining);
    setSelectedId(remaining[0]?.tripId || null);
  };

  return (
    <div className="page-container">
      <PageHeader
        title={data.title}
        subtitle={`📍 ${data.destination} · Last synced: ${formatDateTime(data.lastSynced)}`}
        actions={<button onClick={handleClear} className="btn-danger text-xs">Remove Offline Copy</button>}
      />

      {trips.length > 1 && (
        <div className="mb-6 flex gap-2 overflow-x-auto">
          {trips.map(trip => (
            <button
              key={trip.tripId}
              onClick={() => setSelectedId(trip.tripId)}
              className={`rounded-lg px-3 py-2 text-sm ${
                trip.tripId === data.tripId
                  ? 'bg-blue-600 text-white'
                  : 'border border-slate-200 bg-white text-slate-600'
              }`}
            >
              {trip.title}
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="card">
          <h3 className="font-semibold text-slate-700 mb-2">Emergency Numbers</h3>
          {data.emergencyCard && Object.entries(data.emergencyCard).map(([k, v]) => (
            <div key={k} className="text-sm text-slate-600 flex gap-2 mb-1">
              <span className="text-slate-400 capitalize">{k}:</span> <span className="font-medium">{String(v)}</span>
            </div>
          ))}
        </div>
        <div className="card">
          <h3 className="font-semibold text-slate-700 mb-2">Safety Tips</h3>
          {data.safetyTips?.slice(0, 4).map((t, i) => <p key={i} className="text-sm text-slate-600">· {t}</p>)}
        </div>
      </div>

      <h3 className="font-semibold text-slate-700 mb-3">Itinerary</h3>
      {data.itinerary?.map(day => <ItineraryDayCard key={day.day} day={day} />)}
    </div>
  );
}
