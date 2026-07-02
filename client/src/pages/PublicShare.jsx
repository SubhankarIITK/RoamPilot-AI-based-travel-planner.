import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getPublicShare } from '../api/shareApi.js';
import Loader from '../components/common/Loader.jsx';
import ItineraryDayCard from '../components/itinerary/ItineraryDayCard.jsx';
import { formatDate } from '../utils/formatDate.js';
import { formatCurrency } from '../utils/formatCurrency.js';

export default function PublicShare() {
  const { shareId } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    getPublicShare(shareId)
      .then(res => { setData(res.data.data); setLoading(false); })
      .catch(() => { setError('Share link not found or inactive.'); setLoading(false); });
  }, [shareId]);

  if (loading) return <div className="flex min-h-dvh items-center justify-center"><Loader /></div>;
  if (error) return <div className="flex min-h-dvh items-center justify-center px-4 text-center text-red-500">{error}</div>;

  const { trip } = data;
  const plan = trip?.aiPlan;

  return (
    <div className="min-h-dvh bg-slate-50">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-white px-3 py-3 sm:gap-3 sm:px-4">
        <span className="text-lg font-bold text-blue-600">🧭 RoamPilot</span>
        <span className="text-slate-300">|</span>
        <span className="text-sm text-slate-600">Shared Itinerary</span>
      </div>
      <div className="mx-auto max-w-3xl px-3 py-5 sm:px-4 sm:py-8">
        <h1 className="text-2xl font-bold text-slate-800 mb-1">{trip.title}</h1>
        <p className="text-sm text-slate-500 mb-6">📍 {trip.destination} · {formatDate(trip.startDate)} — {formatDate(trip.endDate)} · {trip.travelers} traveler(s)</p>

        {plan?.summary && (
          <div className="card mb-6">
            <p className="text-sm text-slate-600">{plan.summary}</p>
          </div>
        )}

        {plan?.dayWiseItinerary?.map(day => (
          <ItineraryDayCard key={day.day} day={day} destination={trip.destination} />
        ))}

        {plan?.budgetBreakdown && (
          <div className="card mt-6">
            <h2 className="mb-3 font-semibold text-slate-800">Budget</h2>
            <div className="grid grid-cols-1 gap-2 min-[390px]:grid-cols-2 md:grid-cols-4">
              {Object.entries(plan.budgetBreakdown)
                .filter(([, value]) => typeof value === 'number')
                .map(([key, value]) => (
                  <div key={key} className="rounded-lg bg-slate-50 p-3">
                    <div className="font-semibold text-slate-800">
                      {formatCurrency(value, trip.currency)}
                    </div>
                    <div className="text-xs capitalize text-slate-500">
                      {key.replace(/([A-Z])/g, ' $1')}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {plan?.packingList?.length > 0 && (
          <div className="card mt-6">
            <h2 className="mb-3 font-semibold text-slate-800">Packing List</h2>
            <div className="grid grid-cols-1 gap-4 min-[390px]:grid-cols-2 md:grid-cols-3">
              {plan.packingList.map(category => (
                <div key={category.category}>
                  <div className="text-xs font-semibold uppercase text-slate-500">{category.category}</div>
                  {category.items?.map(item => <div key={item} className="text-sm text-slate-600">• {item}</div>)}
                </div>
              ))}
            </div>
          </div>
        )}

        {plan?.safetyTips?.length > 0 && (
          <div className="card mt-6">
            <h2 className="mb-2 font-semibold text-slate-800">Safety</h2>
            {plan.safetyTips.map(tip => <p key={tip} className="text-sm text-slate-600">• {tip}</p>)}
          </div>
        )}

        {!plan || Object.keys(plan).length === 0 ? (
          <p className="text-slate-500 text-center py-8">No shared trip sections are available.</p>
        ) : null}

        <p className="text-center text-xs text-slate-400 mt-8">Shared via RoamPilot · Read-only view</p>
      </div>
    </div>
  );
}
