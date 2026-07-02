import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getEmergencyInfo, saveEmergencyInfo } from '../api/emergencyApi.js';
import { getTripById } from '../api/tripApi.js';
import { safetyGuide } from '../api/aiApi.js';
import PageHeader from '../components/common/PageHeader.jsx';
import Loader from '../components/common/Loader.jsx';

export default function EmergencyCard() {
  const { id } = useParams();
  const [info, setInfo] = useState({
    tripId: id,
    hotelAddress: '',
    medicalNotes: '',
    embassyInfo: '',
    insuranceInfo: '',
    allergies: [],
    emergencyContacts: [],
    localEmergencyNumbers: {},
  });
  const [trip, setTrip] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [guide, setGuide] = useState(null);
  const [generatingGuide, setGeneratingGuide] = useState(false);

  useEffect(() => {
    Promise.all([getEmergencyInfo(id), getTripById(id)]).then(([infoResponse, tripResponse]) => {
      if (infoResponse.data.data) setInfo({ ...infoResponse.data.data, tripId: id });
      setTrip(tripResponse.data.data);
      setLoading(false);
    });
  }, [id]);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await saveEmergencyInfo(info);
      setInfo(res.data.data);
      setMsg('Saved!');
      setTimeout(() => setMsg(''), 3000);
    } catch { setMsg('Failed to save'); }
    setSaving(false);
  };

  const set = (k, v) => setInfo(i => ({ ...i, [k]: v }));
  const handleGenerateGuide = async () => {
    setGeneratingGuide(true);
    setMsg('');
    try {
      const response = await safetyGuide(id);
      const generated = response.data.data;
      setGuide(generated);
      if (generated.emergencyNumbers) {
        setInfo(current => ({
          ...current,
          localEmergencyNumbers: generated.emergencyNumbers,
        }));
      }
      setMsg('Destination safety guide generated. Verify numbers before saving.');
    } catch (error) {
      setMsg(error.response?.data?.message || 'Failed to generate safety guide');
    } finally {
      setGeneratingGuide(false);
    }
  };
  const setEmergencyNumber = (key, value) => {
    setInfo(current => ({
      ...current,
      localEmergencyNumbers: {
        ...(current.localEmergencyNumbers || {}),
        [key]: value,
      },
    }));
  };

  const savedNumbers = info.localEmergencyNumbers || {};
  const aiEmergencyCard = trip?.aiPlan?.emergencyCard || {};
  const quickNumbers = Object.keys(savedNumbers).some(key => savedNumbers[key])
    ? savedNumbers
    : {
        police: aiEmergencyCard.police,
        ambulance: aiEmergencyCard.ambulance,
        fire: aiEmergencyCard.fire,
      };

  if (loading) return <Loader />;

  return (
    <div className="page-container max-w-2xl">
      <Link to={`/trips/${id}`} className="text-sm text-blue-600 hover:underline mb-4 block">← Workspace</Link>
      <PageHeader title="Emergency Card" subtitle="Critical info for emergencies — save this offline too" />
      {msg && <div className="bg-green-50 text-green-700 text-sm rounded-lg p-3 mb-4">{msg}</div>}
      <button
        type="button"
        onClick={handleGenerateGuide}
        disabled={generatingGuide}
        className="btn-secondary mb-4 w-full sm:w-auto"
      >
        {generatingGuide ? 'Generating...' : 'Generate Destination Safety Guide'}
      </button>

      {guide?.safetyTips?.length > 0 && (
        <div className="card mb-4">
          <h3 className="mb-2 font-semibold text-slate-700">Destination Safety Tips</h3>
          {guide.safetyTips.map(tip => <p key={tip} className="text-sm text-slate-600">• {tip}</p>)}
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-4">
        <div className="card space-y-3">
          <h3 className="font-semibold text-slate-700">Location & Accommodation</h3>
          <div>
            <label className="label">Hotel / Stay Address</label>
            <input className="input" value={info.hotelAddress} onChange={e => set('hotelAddress', e.target.value)} placeholder="Hotel name and full address" />
          </div>
          <div>
            <label className="label">Embassy Info</label>
            <input className="input" value={info.embassyInfo} onChange={e => set('embassyInfo', e.target.value)} placeholder="Embassy address and phone" />
          </div>
        </div>

        <div className="card space-y-3">
          <h3 className="font-semibold text-slate-700">Medical</h3>
          <div>
            <label className="label">Allergies (comma-separated)</label>
            <input className="input" value={info.allergies?.join(', ') || ''} onChange={e => set('allergies', e.target.value.split(',').map(s => s.trim()).filter(Boolean))} />
          </div>
          <div>
            <label className="label">Medical Notes</label>
            <textarea className="input" rows={2} value={info.medicalNotes} onChange={e => set('medicalNotes', e.target.value)} placeholder="Blood type, medications, conditions..." />
          </div>
          <div>
            <label className="label">Insurance Info</label>
            <input className="input" value={info.insuranceInfo} onChange={e => set('insuranceInfo', e.target.value)} placeholder="Policy number, insurer contact..." />
          </div>
        </div>

        <div className="card space-y-3">
          <h3 className="font-semibold text-slate-700">Verified Local Emergency Numbers</h3>
          <p className="text-xs text-slate-500">
            Enter numbers verified for {trip?.destination || 'your destination'}.
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {['police', 'ambulance', 'fire'].map(key => (
              <div key={key}>
                <label className="label capitalize">{key}</label>
                <input
                  className="input"
                  value={savedNumbers[key] || ''}
                  onChange={event => setEmergencyNumber(key, event.target.value)}
                />
              </div>
            ))}
          </div>
        </div>

        <button type="submit" disabled={saving} className="btn-primary w-full">{saving ? 'Saving...' : 'Save Emergency Card'}</button>
      </form>

      {Object.values(quickNumbers).some(Boolean) && (
        <div className="card mt-6 bg-red-50 border-red-200">
          <h3 className="font-semibold text-red-800 mb-2">Quick Emergency Numbers</h3>
          <div className="grid grid-cols-1 gap-2 text-center min-[400px]:grid-cols-3">
            {Object.entries(quickNumbers).filter(([, number]) => number).map(([label, number]) => (
              <div key={label} className="min-w-0 rounded-lg bg-white p-2">
                <div className="break-all font-bold text-red-700">{number}</div>
                <div className="text-xs capitalize text-slate-600">{label}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
