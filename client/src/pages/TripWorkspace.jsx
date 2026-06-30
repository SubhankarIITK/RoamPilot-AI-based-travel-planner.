import { useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getTripById, getTripPlaceImages, getTripWeather } from '../api/tripApi.js';
import { createShare } from '../api/shareApi.js';
import { saveOfflineTrip } from '../utils/localTripStorage.js';
import Loader from '../components/common/Loader.jsx';
import TripScoreCard from '../components/trip/TripScoreCard.jsx';
import ItineraryDayCard from '../components/itinerary/ItineraryDayCard.jsx';
import ItineraryPlaceGallery from '../components/itinerary/ItineraryPlaceGallery.jsx';
import WeatherPanel from '../components/trip/WeatherPanel.jsx';
import { formatDate } from '../utils/formatDate.js';
import { formatCurrency } from '../utils/formatCurrency.js';
import useAuthStore from '../store/authStore.js';

export default function TripWorkspace() {
  const { id } = useParams();
  const [trip, setTrip] = useState(null);
  const [tab, setTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [shareUrl, setShareUrl] = useState('');
  const [message, setMessage] = useState('');
  const [placeGallery, setPlaceGallery] = useState(null);
  const [placeGalleryLoading, setPlaceGalleryLoading] = useState(false);
  const [weather, setWeather] = useState(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const galleryRequestStarted = useRef(false);
  const weatherRequestStarted = useRef(false);
  const user = useAuthStore(state => state.user);

  useEffect(() => {
    galleryRequestStarted.current = false;
    weatherRequestStarted.current = false;
    setPlaceGallery(null);
    setPlaceGalleryLoading(false);
    setWeather(null);
    setWeatherLoading(false);
    setLoading(true);
    getTripById(id).then(res => {
      setTrip(res.data.data);
      setLoading(false);
    });
  }, [id]);

  useEffect(() => {
    if (!['itinerary', 'images'].includes(tab) || String(trip?._id) !== String(id) ||
        !trip?.aiPlan?.dayWiseItinerary?.length ||
        galleryRequestStarted.current) {
      return;
    }
    galleryRequestStarted.current = true;
    setPlaceGalleryLoading(true);
    getTripPlaceImages(id)
      .then(response => setPlaceGallery(response.data.data))
      .catch(() => {
        galleryRequestStarted.current = false;
        setPlaceGallery(null);
      })
      .finally(() => setPlaceGalleryLoading(false));
  }, [id, tab, trip]);

  const loadWeather = () => {
    if (String(trip?._id) !== String(id)) return;
    weatherRequestStarted.current = true;
    setWeatherLoading(true);
    getTripWeather(id)
      .then(response => setWeather(response.data.data))
      .catch(() => {
        weatherRequestStarted.current = false;
        setWeather({ available: false, destination: trip?.destination });
      })
      .finally(() => setWeatherLoading(false));
  };

  useEffect(() => {
    if (tab !== 'weather' || String(trip?._id) !== String(id) || weatherRequestStarted.current) {
      return;
    }
    loadWeather();
  }, [id, tab, trip]);

  const handleSaveOffline = () => {
    try {
      saveOfflineTrip(trip, user?._id);
      setMessage('Trip saved privately for this account');
    } catch (error) {
      setMessage(error.message);
    }
  };

  const handleShare = async () => {
    setMessage('');
    try {
      const response = await createShare(id, {
        allowedSections: ['overview', 'itinerary', 'budget', 'packing', 'safety'],
      });
      const url = `${window.location.origin}/share/${response.data.data.shareId}`;
      setShareUrl(url);
      try {
        await navigator.clipboard?.writeText(url);
        setMessage('Share link created and copied');
      } catch {
        setMessage('Share link created');
      }
    } catch (error) {
      setMessage(error.response?.data?.message || 'Failed to create share link');
    }
  };

  if (loading) return <Loader />;
  if (!trip) return <div className="page-container">Trip not found</div>;

  const plan = trip.aiPlan;
  const getDayGallery = day =>
    placeGallery?.days?.find(galleryDay => Number(galleryDay.day) === Number(day?.day));

  const tabs = [
    { key: 'overview', label: '📋 Overview' },
    { key: 'itinerary', label: '🗓 Itinerary' },
    { key: 'images', label: '🖼 Images' },
    { key: 'weather', label: '🌦 Weather' },
    { key: 'budget', label: '💰 Budget' },
    { key: 'links', label: '🔗 Quick Links' },
  ];

  return (
    <div className="page-container">
      {message && (
        <div className="mb-4 rounded-lg bg-blue-50 p-3 text-sm text-blue-700">
          {message}
          {shareUrl && (
            <a href={shareUrl} className="ml-2 font-medium underline" target="_blank" rel="noreferrer">
              Open link
            </a>
          )}
        </div>
      )}
      <div className="mb-6 flex flex-col gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="mb-1 text-xs font-bold uppercase tracking-[0.14em] text-blue-600">Trip workspace</p>
          <h1 className="truncate text-2xl font-extrabold tracking-tight text-slate-900">{trip.title}</h1>
          <p className="mt-1.5 text-sm leading-6 text-slate-500">📍 {trip.destination} · {formatDate(trip.startDate)} — {formatDate(trip.endDate)} · {trip.travelers} traveler(s)</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to={`/trips/${id}/planner`} className="btn-primary">AI Planner</Link>
          <Link to={`/trips/${id}/bookings`} className="btn-secondary">Book & Compare</Link>
          <button onClick={handleShare} className="btn-secondary">Share</button>
          <button onClick={handleSaveOffline} className="btn-secondary">Save Offline</button>
        </div>
      </div>

      <div className="mb-6 flex gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${tab === t.key ? 'bg-blue-50 text-blue-700 shadow-sm dark:bg-blue-400/15 dark:text-blue-200' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-white/[0.06] dark:hover:text-white'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="card">
            <h3 className="font-semibold text-slate-700 mb-3">Trip Details</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">Mode</span><span>{trip.planningMode}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Style</span><span>{trip.travelStyle}</span></div>
              <div className="flex justify-between">
                <span className="text-slate-500">Budget</span>
                <span>{Number(trip.budget) > 0
                  ? formatCurrency(trip.budget, trip.currency)
                  : String(trip.budgetMode || 'AI-managed').replaceAll('-', ' ')}</span>
              </div>
              <div className="flex justify-between"><span className="text-slate-500">Status</span><span className="capitalize">{trip.status}</span></div>
            </div>
          </div>
          {plan && (
            <div className="card">
              <h3 className="font-semibold text-slate-700 mb-2">AI Summary</h3>
              <p className="text-sm text-slate-600 leading-relaxed">{plan.summary}</p>
              {plan.warnings?.length > 0 && (
                <div className="mt-3 space-y-1">
                  {plan.warnings.map((w, i) => <p key={i} className="text-xs text-amber-600 bg-amber-50 rounded px-2 py-1">⚠️ {w}</p>)}
                </div>
              )}
            </div>
          )}
          {plan?.tripScore && <TripScoreCard score={plan.tripScore} />}
          <button
            type="button"
            onClick={() => setTab('weather')}
            className="group relative overflow-hidden rounded-3xl border border-emerald-200/80 bg-gradient-to-br from-emerald-950 via-emerald-900 to-lime-950 p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-300/80 hover:shadow-xl hover:shadow-emerald-950/20 md:col-span-2"
          >
            <div className="pointer-events-none absolute -right-20 -top-24 h-56 w-56 rounded-full bg-lime-300/15 blur-3xl transition group-hover:bg-lime-300/25" />
            <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-emerald-200/70">Weather window</p>
                <h3 className="mt-1 text-lg font-extrabold text-white">Check current travel weather for {trip.destination}</h3>
                <p className="mt-1 max-w-2xl text-sm leading-6 text-emerald-50/65">
                  Opens a live weather card with current conditions and a 5-day forecast. It loads only when opened and uses cached data to reduce calls.
                </p>
              </div>
              <span className="inline-flex shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-extrabold text-emerald-50">
                Open weather →
              </span>
            </div>
          </button>
          {!plan && (
            <div className="card border-blue-200 bg-blue-50 md:col-span-2 text-center py-8">
              <p className="text-blue-800 font-medium mb-3">No AI plan generated yet</p>
              <Link to={`/trips/${id}/planner`} className="btn-primary">Generate AI Plan</Link>
            </div>
          )}
        </div>
      )}

      {tab === 'itinerary' && (
        <div>
          {plan?.dayWiseItinerary?.length > 0 ? (
            plan.dayWiseItinerary.map(day => <ItineraryDayCard key={day.day} day={day} dayGallery={getDayGallery(day)} imagesLoading={placeGalleryLoading} />)
          ) : (
            <div className="text-center py-12 text-slate-500">
              <p className="mb-4">No itinerary yet.</p>
              <Link to={`/trips/${id}/planner`} className="btn-primary">Generate Plan</Link>
            </div>
          )}
        </div>
      )}

      {tab === 'images' && (
        plan?.dayWiseItinerary?.length > 0 ? (
          <ItineraryPlaceGallery gallery={placeGallery} loading={placeGalleryLoading} />
        ) : (
          <div className="card py-12 text-center text-slate-500">
            <p className="mb-4">Generate an itinerary to create its place image collection.</p>
            <Link to={`/trips/${id}/planner`} className="btn-primary">Generate Plan</Link>
          </div>
        )
      )}

      {tab === 'weather' && (
        <WeatherPanel weather={weather} loading={weatherLoading} onRefresh={loadWeather} />
      )}

      {tab === 'budget' && plan?.budgetBreakdown && (
        <div className="card max-w-lg">
          <h3 className="font-semibold text-slate-700 mb-4">Budget Breakdown</h3>
          {plan.budgetSummary && (
            <div className={`mb-4 rounded-2xl border p-4 ${
              ['insufficient', 'over-budget'].includes(plan.budgetSummary.verdict || plan.budgetSummary.status)
                ? 'border-red-200 bg-red-50 dark:border-red-300/20 dark:bg-red-400/10'
                : 'border-emerald-200 bg-emerald-50 dark:border-emerald-300/15 dark:bg-emerald-400/[0.08]'
            }`}>
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Budget verdict</span>
                <span className="text-sm font-extrabold capitalize text-slate-800 dark:text-white">
                  {String(plan.budgetSummary.verdict || plan.budgetSummary.status || 'comfortable').replaceAll('-', ' ')}
                </span>
              </div>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                Realistic expected spend: <strong>{formatCurrency(plan.budgetSummary.expectedSpend, trip.currency)}</strong>
              </p>
              {Number(plan.budgetSummary.shortfall) > 0 && (
                <p className="mt-1 text-sm font-semibold text-red-700 dark:text-red-300">
                  Additional budget needed: {formatCurrency(plan.budgetSummary.shortfall, trip.currency)}
                </p>
              )}
              {Number(plan.budgetSummary.shortfall) <= 0 && Number(plan.budgetSummary.savings) > 0 && (
                <p className="mt-1 text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                  Unused savings: {formatCurrency(plan.budgetSummary.savings, trip.currency)}
                </p>
              )}
            </div>
          )}
          <div className="space-y-2">
            {Object.entries(plan.budgetBreakdown).filter(([, value]) => typeof value === 'number').map(([k, v]) => (
              <div key={k} className="flex justify-between text-sm py-1.5 border-b border-slate-100">
                <span className="text-slate-600 capitalize">{k.replace(/([A-Z])/g, ' $1')}</span>
                <span className="font-medium">{formatCurrency(v, trip.currency)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'links' && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {[
            { to: `/trips/${id}/chat`, icon: '💬', label: 'AI Chat' },
            { to: `/trips/${id}/bookings`, icon: '🎫', label: 'Book & Compare' },
            { to: `/trips/${id}/expenses`, icon: '💸', label: 'Expenses' },
            { to: `/trips/${id}/checklist`, icon: '✅', label: 'Checklist' },
            { to: `/trips/${id}/documents`, icon: '📁', label: 'Documents' },
            { to: `/trips/${id}/versions`, icon: '🔄', label: 'Versions' },
            { to: `/trips/${id}/emergency`, icon: '🆘', label: 'Emergency' },
            { to: `/trips/${id}/memory`, icon: '📝', label: 'Trip Memory' },
          ].map(link => (
            <Link key={link.to} to={link.to} className="card hover:shadow-md text-center py-6 transition-shadow">
              <div className="text-3xl mb-2">{link.icon}</div>
              <div className="text-sm font-medium text-slate-700">{link.label}</div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
