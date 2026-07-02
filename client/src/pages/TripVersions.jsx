import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getTripVersions, getVersion, restoreVersion, deleteVersion } from '../api/versionApi.js';
import PageHeader from '../components/common/PageHeader.jsx';
import Loader from '../components/common/Loader.jsx';
import { formatDateTime } from '../utils/formatDate.js';

export default function TripVersions() {
  const { id } = useParams();
  const [versions, setVersions] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  useEffect(() => {
    getTripVersions(id).then(res => {
      setVersions(res.data.data);
      setLoading(false);
    });
  }, [id]);

  const handleView = async (vid) => {
    const res = await getVersion(vid);
    setSelected(res.data.data);
  };

  const handleDelete = async (vid) => {
    if (!confirm('Delete this version?')) return;
    await deleteVersion(vid);
    setVersions(versions.filter(v => v._id !== vid));
    if (selected?._id === vid) setSelected(null);
  };

  const handleRestore = async () => {
    if (!selected || !confirm('Restore this version as the current trip plan?')) return;
    await restoreVersion(selected._id);
    setMessage('Version restored. A backup of the previous plan was created.');
  };

  if (loading) return <Loader />;

  return (
    <div className="page-container">
      <Link to={`/trips/${id}`} className="text-sm text-blue-600 hover:underline mb-4 block">← Workspace</Link>
      <PageHeader title="Trip Versions" subtitle="History of AI-generated and transformed plans" />
      {message && <div className="mb-4 rounded-lg bg-green-50 p-3 text-sm text-green-700">{message}</div>}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-2">
          {versions.length === 0 && <p className="text-sm text-slate-500">No versions yet. Generate an AI plan to create one.</p>}
          {versions.map(v => (
            <div key={v._id} className={`card cursor-pointer hover:shadow-md transition-shadow ${selected?._id === v._id ? 'border-blue-300 bg-blue-50' : ''}`}>
              <div className="flex items-start justify-between">
                <div onClick={() => handleView(v._id)} className="flex-1">
                  <div className="font-medium text-slate-800 text-sm">{v.versionName}</div>
                  <div className="text-xs text-slate-500">{v.source} · {formatDateTime(v.createdAt)}</div>
                  {v.score?.overall && <div className="text-xs text-blue-600 mt-1">Score: {v.score.overall}/10</div>}
                </div>
                <button onClick={() => handleDelete(v._id)} className="text-xs text-red-400 hover:text-red-600 ml-2">×</button>
              </div>
            </div>
          ))}
        </div>

        {selected && (
          <div className="card overflow-auto md:col-span-2">
            <div className="mb-3 flex flex-col gap-3 min-[460px]:flex-row min-[460px]:items-center min-[460px]:justify-between">
              <h3 className="font-semibold text-slate-700">{selected.versionName}</h3>
              <button onClick={handleRestore} className="btn-primary w-full text-xs min-[460px]:w-auto">Restore Version</button>
            </div>
            {selected.fullPlan?.summary && <p className="text-sm text-slate-600 mb-4">{selected.fullPlan.summary}</p>}
            {selected.itinerary?.map((day, i) => (
              <div key={i} className="border-b border-slate-100 py-2">
                <div className="font-medium text-sm">Day {day.day}: {day.theme}</div>
                <div className="text-xs text-slate-500">{day.estimatedCost}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
