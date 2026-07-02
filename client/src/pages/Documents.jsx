import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getTripDocuments, uploadDocument, deleteDocument } from '../api/documentApi.js';
import PageHeader from '../components/common/PageHeader.jsx';
import Loader from '../components/common/Loader.jsx';
import EmptyState from '../components/common/EmptyState.jsx';
import SelectField from '../components/common/SelectField.jsx';

const categories = ['ticket', 'hotel', 'visa', 'passport', 'photo', 'insurance', 'other'];

export default function Documents() {
  const { id } = useParams();
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({ category: 'other', notes: '' });
  const [file, setFile] = useState(null);

  const fetchDocs = async () => {
    const res = await getTripDocuments(id);
    setDocs(res.data.data);
    setLoading(false);
  };

  useEffect(() => { fetchDocs(); }, [id]);

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) return;
    setUploading(true);
    const fd = new FormData();
    fd.append('file', file);
    fd.append('tripId', id);
    fd.append('category', form.category);
    fd.append('notes', form.notes);
    try {
      await uploadDocument(fd);
      await fetchDocs();
      setFile(null);
      setForm({ category: 'other', notes: '' });
    } catch (err) {
      console.error(err);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (docId) => {
    if (!confirm('Delete this document?')) return;
    await deleteDocument(docId);
    setDocs(docs.filter(d => d._id !== docId));
  };

  if (loading) return <Loader />;

  return (
    <div className="page-container">
      <div className="flex items-center gap-3 mb-4">
        <Link to={`/trips/${id}`} className="text-sm text-blue-600 hover:underline">← Workspace</Link>
      </div>
      <PageHeader title="Documents" subtitle="Upload tickets, bookings, passports, and photos" />

      <form onSubmit={handleUpload} className="card mb-6 space-y-4">
        <h3 className="text-base font-bold text-slate-900">Upload Document</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="label">File</label>
            <input type="file" className="input" onChange={e => setFile(e.target.files[0])} accept="image/*,.pdf" />
          </div>
          <div>
            <label className="label">Category</label>
            <SelectField
              value={form.category}
              onChange={category => setForm({ ...form, category })}
              options={categories.map(category => ({
                value: category,
                label: category.charAt(0).toUpperCase() + category.slice(1),
              }))}
              ariaLabel="Document category"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Notes</label>
            <input className="input" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="e.g. Return flight Mumbai-Goa" />
          </div>
        </div>
        <button type="submit" disabled={uploading || !file} className="btn-primary">
          {uploading ? 'Uploading...' : 'Upload'}
        </button>
      </form>

      {docs.length === 0 ? (
        <EmptyState icon="📁" title="No documents yet" message="Upload tickets, visa, hotel bookings, or trip photos." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {docs.map(doc => (
            <div key={doc._id} className="card">
              <div className="flex items-start justify-between mb-2">
                <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{doc.category}</span>
                <button onClick={() => handleDelete(doc._id)} className="text-xs text-red-500 hover:text-red-700">Delete</button>
              </div>
              {doc.fileType?.startsWith('image') ? (
                <img src={doc.fileUrl} alt={doc.originalName} className="w-full h-32 object-cover rounded-lg mb-2" />
              ) : (
                <div className="w-full h-32 bg-slate-100 rounded-lg flex items-center justify-center text-3xl mb-2">📄</div>
              )}
              <p className="text-xs text-slate-600 truncate">{doc.originalName}</p>
              {doc.notes && <p className="text-xs text-slate-400 mt-1">{doc.notes}</p>}
              <a href={doc.fileUrl} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline mt-1 block">View →</a>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
