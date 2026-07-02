import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getTripMemory, saveMemory } from '../api/memoryApi.js';
import Loader from '../components/common/Loader.jsx';
import PageHeader from '../components/common/PageHeader.jsx';
import SelectField from '../components/common/SelectField.jsx';

const initialMemory = {
  likedPlaces: [],
  dislikedPlaces: [],
  preferredPace: '',
  preferredFood: [],
  budgetBehavior: '',
  notes: '',
};

export default function TripMemory() {
  const { id } = useParams();
  const [memory, setMemory] = useState(initialMemory);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    getTripMemory(id)
      .then(response => {
        if (response.data.data) setMemory(response.data.data);
      })
      .finally(() => setLoading(false));
  }, [id]);

  const setList = (key, value) => {
    setMemory(current => ({
      ...current,
      [key]: value.split(',').map(item => item.trim()).filter(Boolean),
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setMessage('');
    try {
      const response = await saveMemory({ ...memory, tripId: id });
      setMemory(response.data.data);
      setMessage('Trip memory saved');
    } catch (error) {
      setMessage(error.response?.data?.message || 'Failed to save trip memory');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Loader />;

  return (
    <div className="page-container max-w-2xl">
      <Link to={`/trips/${id}`} className="mb-4 block text-sm text-blue-600 hover:underline">
        ← Workspace
      </Link>
      <PageHeader
        title="Trip Memory"
        subtitle="Save what you learned so future plans can improve"
      />
      {message && <div className="mb-4 rounded-lg bg-blue-50 p-3 text-sm text-blue-700">{message}</div>}
      <form onSubmit={handleSubmit} className="card space-y-4">
        <div>
          <label className="label">Places you liked</label>
          <input
            className="input"
            value={memory.likedPlaces?.join(', ') || ''}
            onChange={event => setList('likedPlaces', event.target.value)}
            placeholder="Camden Market, Hyde Park"
          />
        </div>
        <div>
          <label className="label">Places you disliked</label>
          <input
            className="input"
            value={memory.dislikedPlaces?.join(', ') || ''}
            onChange={event => setList('dislikedPlaces', event.target.value)}
          />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Preferred pace</label>
            <SelectField
              value={memory.preferredPace || ''}
              onChange={value => setMemory(current => ({ ...current, preferredPace: value }))}
              options={[
                { value: '', label: 'Not specified' },
                { value: 'relaxed', label: 'Relaxed' },
                { value: 'balanced', label: 'Balanced' },
                { value: 'packed', label: 'Packed' },
              ]}
              ariaLabel="Preferred pace"
            />
          </div>
          <div>
            <label className="label">Food preferences discovered</label>
            <input
              className="input"
              value={memory.preferredFood?.join(', ') || ''}
              onChange={event => setList('preferredFood', event.target.value)}
            />
          </div>
        </div>
        <div>
          <label className="label">Budget behavior</label>
          <input
            className="input"
            value={memory.budgetBehavior || ''}
            onChange={event => setMemory(current => ({ ...current, budgetBehavior: event.target.value }))}
            placeholder="Spent more on food, less on transport"
          />
        </div>
        <div>
          <label className="label">Notes</label>
          <textarea
            className="input"
            rows={4}
            value={memory.notes || ''}
            onChange={event => setMemory(current => ({ ...current, notes: event.target.value }))}
          />
        </div>
        <button type="submit" disabled={saving} className="btn-primary w-full">
          {saving ? 'Saving...' : 'Save Trip Memory'}
        </button>
      </form>
    </div>
  );
}
