import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createTrip, parseTripDescription } from '../api/tripApi.js';
import PageHeader from '../components/common/PageHeader.jsx';
import VoiceInputButton from '../components/common/VoiceInputButton.jsx';

const planningModes = ['Budget Saver', 'Luxury Comfort', 'Hidden Gems', 'Foodie', 'Family Safe', 'Couple Romantic', 'Backpacker', 'Weekend Fast Plan', 'Slow Travel', 'Photography', 'Adventure', 'Spiritual/Cultural'];

export default function CreateTrip() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    title: '', origin: '', destination: '', startDate: '', endDate: '',
    travelers: 1, budget: '', currency: 'INR', travelStyle: 'balanced',
    planningMode: 'Hidden Gems', mustVisitPlaces: '', avoidList: '', notes: '',
  });
  const [creationMode, setCreationMode] = useState('ai');
  const [description, setDescription] = useState('');
  const [aiMessage, setAiMessage] = useState('');
  const [parsing, setParsing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const set = (key, value) => setForm(current => ({ ...current, [key]: value }));

  const handleParseDescription = async () => {
    if (description.trim().length < 15) {
      setError('Describe your trip in a little more detail.');
      return;
    }

    setParsing(true);
    setError('');
    setAiMessage('');
    try {
      const response = await parseTripDescription(description.trim());
      const { draft, missingFields = [] } = response.data.data;
      setForm(current => ({
        ...current,
        ...draft,
        title: draft.title || current.title,
        origin: draft.origin || '',
        destination: draft.destination || '',
        startDate: draft.startDate || '',
        endDate: draft.endDate || '',
        travelers: draft.travelers || 1,
        budget: draft.budget || '',
        currency: draft.currency || current.currency,
        travelStyle: draft.travelStyle || current.travelStyle,
        planningMode: draft.planningMode || current.planningMode,
        mustVisitPlaces: (draft.mustVisitPlaces || []).join(', '),
        avoidList: (draft.avoidList || []).join(', '),
        notes: draft.notes || description.trim(),
      }));
      setCreationMode('form');
      setAiMessage(missingFields.length
        ? `AI prepared the draft. Please review it and complete: ${missingFields.join(', ')}.`
        : 'AI prepared the trip details. Review them before creating the trip.');
    } catch (err) {
      setError(err.response?.data?.message || 'AI could not understand the trip description.');
    } finally {
      setParsing(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = {
        ...form,
        budget: Number(form.budget),
        travelers: Number(form.travelers),
        mustVisitPlaces: form.mustVisitPlaces.split(',').map(value => value.trim()).filter(Boolean),
        avoidList: form.avoidList.split(',').map(value => value.trim()).filter(Boolean),
      };
      const response = await createTrip(data);
      navigate(`/trips/${response.data.data._id}`);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create trip');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-container max-w-3xl">
      <PageHeader title="Plan a New Trip" subtitle="Describe the journey naturally or enter the details yourself" />
      {error && <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</div>}

      <div className="mb-5 grid grid-cols-2 gap-2 rounded-xl border border-slate-200 bg-white p-1.5 shadow-sm">
        <button type="button" onClick={() => setCreationMode('ai')} className={`rounded-lg px-3 py-2.5 text-sm font-semibold transition ${creationMode === 'ai' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}>
          Describe with AI
        </button>
        <button type="button" onClick={() => setCreationMode('form')} className={`rounded-lg px-3 py-2.5 text-sm font-semibold transition ${creationMode === 'form' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}>
          Manual details
        </button>
      </div>

      {creationMode === 'ai' && (
        <section className="card overflow-hidden p-0">
          <div className="border-b border-blue-100 bg-gradient-to-r from-blue-50 to-indigo-50 p-5 dark:from-blue-500/10 dark:to-indigo-500/10 sm:p-7">
            <span className="mb-3 inline-flex rounded-full bg-white px-3 py-1 text-xs font-bold text-blue-700 shadow-sm dark:bg-blue-400/10 dark:text-blue-200">AI trip builder</span>
            <h2 className="text-xl font-bold text-slate-900">Tell us what your ideal trip looks like</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Include the destination, dates, travelers, budget, interests, pace, and anything you want to avoid. Write normally.</p>
          </div>
          <div className="space-y-4 p-5 sm:p-7">
            <div className="flex items-center justify-between gap-3">
              <label className="label mb-0" htmlFor="trip-description">Your trip description</label>
              <VoiceInputButton value={description} onChange={setDescription} label="Speak your trip description" />
            </div>
            <textarea
              data-voice-disabled="true"
              id="trip-description"
              className="input min-h-44 resize-y leading-6"
              value={description}
              onChange={event => setDescription(event.target.value)}
              placeholder="Plan a 7-day family trip from Kolkata to Kerala in December for 4 people. Budget is ₹1,20,000. We prefer a relaxed pace, nature, local food, and comfortable hotels. Avoid long hikes."
            />
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs leading-5 text-slate-500">AI creates an editable draft. Nothing is saved until you review and create it.</p>
              <button type="button" onClick={handleParseDescription} disabled={parsing} className="btn-primary min-w-40">
                {parsing ? 'Understanding...' : 'Create editable draft'}
              </button>
            </div>
          </div>
        </section>
      )}

      {creationMode === 'form' && (
        <form onSubmit={handleSubmit} className="card space-y-5">
          {aiMessage && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{aiMessage}</div>}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2"><label className="label">Trip Title</label><input className="input" value={form.title} onChange={event => set('title', event.target.value)} placeholder="Goa Beach Vacation" required /></div>
            <div><label className="label">Origin</label><input className="input" value={form.origin} onChange={event => set('origin', event.target.value)} placeholder="Mumbai" /></div>
            <div><label className="label">Destination *</label><input className="input" value={form.destination} onChange={event => set('destination', event.target.value)} placeholder="Goa" required /></div>
            <div><label className="label">Start Date</label><input className="input" type="date" value={form.startDate} onChange={event => set('startDate', event.target.value)} /></div>
            <div><label className="label">End Date</label><input className="input" type="date" value={form.endDate} onChange={event => set('endDate', event.target.value)} /></div>
            <div><label className="label">Travelers</label><input className="input" type="number" min="1" value={form.travelers} onChange={event => set('travelers', event.target.value)} /></div>
            <div>
              <label className="label">Total Budget</label>
              <div className="flex gap-2">
                <select className="input w-24" value={form.currency} onChange={event => set('currency', event.target.value)}><option>INR</option><option>USD</option><option>EUR</option><option>GBP</option></select>
                <input className="input flex-1" type="number" value={form.budget} onChange={event => set('budget', event.target.value)} placeholder="50000" />
              </div>
            </div>
            <div><label className="label">Travel Style</label><select className="input" value={form.travelStyle} onChange={event => set('travelStyle', event.target.value)}><option value="relaxed">Relaxed</option><option value="balanced">Balanced</option><option value="packed">Packed</option></select></div>
            <div><label className="label">Planning Mode</label><select className="input" value={form.planningMode} onChange={event => set('planningMode', event.target.value)}>{planningModes.map(mode => <option key={mode}>{mode}</option>)}</select></div>
            <div className="sm:col-span-2"><label className="label">Must-Visit Places (comma-separated)</label><input className="input" value={form.mustVisitPlaces} onChange={event => set('mustVisitPlaces', event.target.value)} placeholder="Baga Beach, Dudhsagar Falls" /></div>
            <div className="sm:col-span-2"><label className="label">Things to Avoid (comma-separated)</label><input className="input" value={form.avoidList} onChange={event => set('avoidList', event.target.value)} placeholder="casinos, nightclubs" /></div>
            <div className="sm:col-span-2"><label className="label">Notes</label><textarea className="input" rows={3} value={form.notes} onChange={event => set('notes', event.target.value)} placeholder="Anniversary trip, traveling with elderly parents..." /></div>
          </div>
          <button type="submit" disabled={loading} className="btn-primary w-full py-3 text-base">{loading ? 'Creating Trip...' : 'Create Trip →'}</button>
        </form>
      )}
    </div>
  );
}
