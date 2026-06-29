import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getTripChecklist, addChecklistItem, toggleChecklistItem, deleteChecklistItem } from '../api/checklistApi.js';
import { createPackingList } from '../api/aiApi.js';
import PageHeader from '../components/common/PageHeader.jsx';
import Loader from '../components/common/Loader.jsx';

const categoryColors = {
  documents: 'bg-blue-100 text-blue-700',
  clothes: 'bg-purple-100 text-purple-700',
  electronics: 'bg-slate-100 text-slate-700',
  medicines: 'bg-red-100 text-red-700',
  toiletries: 'bg-green-100 text-green-700',
  general: 'bg-gray-100 text-gray-700',
};

export default function Checklist() {
  const { id } = useParams();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ title: '', category: 'general', priority: 'medium' });
  const [generating, setGenerating] = useState(false);

  const fetchItems = async () => {
    const res = await getTripChecklist(id);
    setItems(res.data.data);
    setLoading(false);
  };

  useEffect(() => { fetchItems(); }, [id]);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    await addChecklistItem({ ...form, tripId: id });
    setForm({ title: '', category: 'general', priority: 'medium' });
    fetchItems();
  };

  const handleToggle = async (itemId) => {
    await toggleChecklistItem(itemId);
    setItems(items.map(i => i._id === itemId ? { ...i, isDone: !i.isDone } : i));
  };

  const handleDelete = async (itemId) => {
    await deleteChecklistItem(itemId);
    setItems(items.filter(i => i._id !== itemId));
  };

  const handleGenerateAI = async () => {
    setGenerating(true);
    try {
      await createPackingList(id);
      await fetchItems();
    } catch { }
    setGenerating(false);
  };

  const grouped = items.reduce((acc, item) => {
    const cat = item.category || 'general';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {});

  const done = items.filter(i => i.isDone).length;

  if (loading) return <Loader />;

  return (
    <div className="page-container">
      <Link to={`/trips/${id}`} className="text-sm text-blue-600 hover:underline mb-4 block">← Workspace</Link>
      <PageHeader
        title="Packing Checklist"
        subtitle={`${done}/${items.length} items packed`}
        actions={
          <button onClick={handleGenerateAI} disabled={generating} className="btn-secondary text-xs">
            {generating ? 'Generating...' : '🤖 AI Generate List'}
          </button>
        }
      />

      <form onSubmit={handleAdd} className="card mb-6 flex gap-3 flex-wrap">
        <input className="input flex-1 min-w-40" placeholder="Add item..." value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
        <select className="input w-36" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
          {['general', 'documents', 'clothes', 'electronics', 'medicines', 'toiletries', 'emergency'].map(c => <option key={c}>{c}</option>)}
        </select>
        <button type="submit" className="btn-primary">Add</button>
      </form>

      <div className="space-y-4">
        {Object.entries(grouped).map(([cat, catItems]) => (
          <div key={cat}>
            <div className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full mb-2 ${categoryColors[cat] || 'bg-gray-100 text-gray-700'}`}>
              {cat} ({catItems.filter(i => i.isDone).length}/{catItems.length})
            </div>
            <div className="space-y-1.5">
              {catItems.map(item => (
                <div key={item._id} className={`flex items-center gap-3 p-3 rounded-lg border ${item.isDone ? 'bg-slate-50 border-slate-100' : 'bg-white border-slate-200'}`}>
                  <input
                    type="checkbox"
                    checked={item.isDone}
                    onChange={() => handleToggle(item._id)}
                    className="w-4 h-4 rounded"
                  />
                  <span className={`text-sm flex-1 ${item.isDone ? 'line-through text-slate-400' : 'text-slate-700'}`}>{item.title}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded ${item.priority === 'high' ? 'bg-red-100 text-red-600' : item.priority === 'low' ? 'bg-slate-100 text-slate-500' : 'bg-yellow-100 text-yellow-600'}`}>
                    {item.priority}
                  </span>
                  <button onClick={() => handleDelete(item._id)} className="text-xs text-red-400 hover:text-red-600">×</button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}