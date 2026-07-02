import { useEffect, useState } from 'react';
import api from '../api/axiosInstance.js';
import PageHeader from '../components/common/PageHeader.jsx';
import Loader from '../components/common/Loader.jsx';

export default function TravelProfile() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    api.get('/profile').then(res => { setProfile(res.data.data); setLoading(false); });
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put('/profile', profile);
      setMsg('Profile saved!');
      setTimeout(() => setMsg(''), 3000);
    } catch {
      setMsg('Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const set = (key, val) => setProfile(p => ({ ...p, [key]: val }));
  const setList = (key, value) =>
    set(key, value.split(',').map(item => item.trim()).filter(Boolean));

  if (loading) return <Loader />;

  return (
    <div className="page-container max-w-3xl">
      <PageHeader title="Travel Personality Profile" subtitle="Help AI understand your preferences" />
      {msg && <div className="bg-green-50 text-green-700 text-sm rounded-lg p-3 mb-4">{msg}</div>}
      <form onSubmit={handleSave} className="space-y-6">
        <div className="card grid grid-cols-1 gap-4 sm:grid-cols-2">
          <h3 className="sm:col-span-2 text-base font-bold text-slate-900">Core Preferences</h3>
          <div>
            <label className="label">Budget Type</label>
            <select className="input" value={profile.budgetType} onChange={e => set('budgetType', e.target.value)}>
              <option value="budget">Budget</option>
              <option value="mid-range">Mid-Range</option>
              <option value="luxury">Luxury</option>
            </select>
          </div>
          <div>
            <label className="label">Travel Pace</label>
            <select className="input" value={profile.travelPace} onChange={e => set('travelPace', e.target.value)}>
              <option value="relaxed">Relaxed</option>
              <option value="balanced">Balanced</option>
              <option value="packed">Packed</option>
            </select>
          </div>
          <div>
            <label className="label">Food Preference</label>
            <input className="input" value={profile.foodPreference} onChange={e => set('foodPreference', e.target.value)} placeholder="vegetarian, vegan, non-veg..." />
          </div>
          <div>
            <label className="label">Hotel Preference</label>
            <input className="input" value={profile.hotelPreference} onChange={e => set('hotelPreference', e.target.value)} placeholder="hostel, hotel, resort..." />
          </div>
          <div>
            <label className="label">Adventure Level (1-10)</label>
            <input className="input" type="number" min="1" max="10" value={profile.adventureLevel} onChange={e => set('adventureLevel', Number(e.target.value))} />
          </div>
          <div>
            <label className="label">Experience Level</label>
            <select className="input" value={profile.travelExperienceLevel} onChange={e => set('travelExperienceLevel', e.target.value)}>
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="expert">Expert</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="label">Interests (comma-separated)</label>
            <input className="input" value={profile.interests?.join(', ') || ''} onChange={e => set('interests', e.target.value.split(',').map(i => i.trim()).filter(Boolean))} placeholder="history, food, adventure, photography..." />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Medical Constraints</label>
            <input className="input" value={profile.medicalConstraints} onChange={e => set('medicalConstraints', e.target.value)} placeholder="allergies, mobility needs..." />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Accessibility Needs</label>
            <input className="input" value={profile.accessibilityNeeds || ''} onChange={e => set('accessibilityNeeds', e.target.value)} placeholder="step-free access, limited walking, wheelchair access..." />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Preferred Transport (comma-separated)</label>
            <input className="input" value={profile.preferredTransport?.join(', ') || ''} onChange={e => setList('preferredTransport', e.target.value)} placeholder="metro, train, taxi, private car..." />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Things to Avoid</label>
            <input className="input" value={profile.dislikedThings?.join(', ') || ''} onChange={e => set('dislikedThings', e.target.value.split(',').map(i => i.trim()).filter(Boolean))} placeholder="crowded places, museums, nightlife..." />
          </div>
          <div>
            <label className="label">Nightlife Preference</label>
            <select className="input" value={profile.nightlifePreference || 'moderate'} onChange={e => set('nightlifePreference', e.target.value)}>
              <option value="none">None</option>
              <option value="low">Low</option>
              <option value="moderate">Moderate</option>
              <option value="high">High</option>
            </select>
          </div>
          <div>
            <label className="label">Shopping Preference</label>
            <select className="input" value={profile.shoppingPreference || 'moderate'} onChange={e => set('shoppingPreference', e.target.value)}>
              <option value="none">None</option>
              <option value="low">Low</option>
              <option value="moderate">Moderate</option>
              <option value="high">High</option>
            </select>
          </div>
          <div>
            <label className="label">Preferred Climate</label>
            <input className="input" value={profile.preferredClimate || ''} onChange={e => set('preferredClimate', e.target.value)} placeholder="cool, tropical, dry..." />
          </div>
          <div>
            <label className="label">Language Comfort</label>
            <input className="input" value={profile.languageComfort?.join(', ') || ''} onChange={e => setList('languageComfort', e.target.value)} placeholder="English, Hindi..." />
          </div>
        </div>
        <button type="submit" disabled={saving} className="btn-primary w-full sm:w-auto">
          {saving ? 'Saving...' : 'Save Profile'}
        </button>
      </form>
    </div>
  );
}
